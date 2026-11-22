import { errorMessage } from "../errors";
import type { Company } from "../types";
import type { WebsiteAnalysis, WebsiteAnalyzer } from "./types";
import { fetchPageSpeed } from "./pagespeed";
import { assessReputation } from "./reputation";
import { safeFetchHtml, type FetchedPage } from "./safe-fetch";
import { extractSignals, findContactLinks, type WebsiteSignals } from "./signals";
import { interpretWithClaude, type LlmExtraOpportunity } from "./llm";
import { detectRules } from "./detector";

export interface AnalysisSignals {
  website: WebsiteSignals;
  pagespeed: Awaited<ReturnType<typeof fetchPageSpeed>>;
  reputation: ReturnType<typeof assessReputation>;
  llm: { used: boolean; error: string | null; extraOpportunities: LlmExtraOpportunity[] };
  [k: string]: unknown;
}

export function fallbackSummary(c: Company, s: AnalysisSignals): string {
  const w = s.website;
  if (!c.website) return `${c.name} no tiene sitio web registrado en las fuentes consultadas. ${s.reputation.note}`;
  if (!w.reachable) return `No se pudo analizar la web de ${c.name} (${w.error ?? "sin respuesta válida"}). ${s.reputation.note}`;
  const has = [w.booking.detected && "reservas online", w.whatsapp.detected && "WhatsApp", w.chat.detected && "chat", w.forms.length && "formulario"].filter(Boolean);
  const lacks = [!w.booking.detected && "reservas online", !w.whatsapp.detected && "WhatsApp", !w.chat.detected && "chat"].filter(Boolean);
  return `Resumen automático sin interpretación de IA: la web de ${c.name} muestra ${has.join(", ") || "pocos canales de contacto"}; no se detectaron ${lacks.join(", ") || "carencias evidentes"}. ${s.reputation.note}`.trim();
}

export const websiteAnalyzer: WebsiteAnalyzer = {
  async analyze(company: Company): Promise<WebsiteAnalysis> {
    const fetchedAt = new Date().toISOString();
    let website = extractSignals([]);
    let snapshot: Record<string, unknown> | null = null;
    if (company.website) {
      try {
        const home = await safeFetchHtml(company.website);
        const pages: FetchedPage[] = [home];
        if (home.html && home.status < 400) {
          for (const link of findContactLinks(home.html, home.url)) {
            try { const p = await safeFetchHtml(link, { timeoutMs: 10000 }); if (p.status < 400 && p.html) pages.push(p); } catch { /* página secundaria opcional */ }
          }
        }
        website = extractSignals(pages);
        if (home.status >= 400) website.error = `HTTP ${home.status}`;
        else if (!home.html) website.error = "respuesta sin HTML";
        snapshot = { url: home.url, status: home.status, fetchedAt, loadMs: home.loadMs, redirects: home.redirects, truncated: home.truncated, pages: website.pagesFetched };
      } catch (e) {
        const cause = (e as { cause?: unknown })?.cause;
        website = { ...extractSignals([]), error: cause ? `${errorMessage(e)} (${errorMessage(cause)})` : errorMessage(e) };
        snapshot = { url: company.website, status: null, fetchedAt, error: website.error };
      }
    }
    const pagespeed = website.reachable && website.url ? await fetchPageSpeed(website.url) : null;
    const signals: AnalysisSignals = {
      website, pagespeed, reputation: assessReputation(company),
      llm: { used: false, error: null, extraOpportunities: [] },
    };

    let summary = "";
    let model: string | null = null;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const known = detectRules(company, signals).map((d) => d.problemKey);
        const r = await interpretWithClaude(company, { website, pagespeed, reputation: signals.reputation }, known);
        summary = r.summary; model = r.model; signals.llm = { used: true, error: null, extraOpportunities: r.extraOpportunities };
      } catch (e) { signals.llm.error = errorMessage(e); }
    } else signals.llm.error = "ANTHROPIC_API_KEY no configurada: análisis solo por reglas";
    if (!summary) summary = fallbackSummary(company, signals);

    // Confianza del análisis: depende de cuánto se pudo observar de verdad
    let confidence: WebsiteAnalysis["confidence"] = "low";
    if (website.reachable) confidence = website.jsHeavy || !signals.llm.used ? "medium" : "high";
    return { summary, signals, snapshot, model, confidence };
  },
};
