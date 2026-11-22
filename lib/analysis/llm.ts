import { NotConfiguredError } from "../errors";
import type { Company } from "../types";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export interface LlmExtraOpportunity {
  title: string; problem: string; evidenceKeys: string[]; consequence: string; solution: string; service: string; impact: string;
}
export interface LlmInterpretation { summary: string; extraOpportunities: LlmExtraOpportunity[]; model: string }

export async function callClaude(system: string, user: string, opts: { maxTokens?: number; model?: string } = {}): Promise<{ text: string; model: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NotConfiguredError("Anthropic (Claude)", ["ANTHROPIC_API_KEY"]);
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(90000),
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 1500, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { content?: Array<{ type: string; text?: string }>; model?: string };
  const text = (j.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  return { text, model: j.model ?? model };
}

export function extractJson(text: string): unknown {
  const start = text.indexOf("{"); const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La respuesta no contiene JSON");
  return JSON.parse(text.slice(start, end + 1));
}

const SYSTEM = `Eres analista comercial de una consultora de IA y automatización. Recibes SEÑALES OBSERVADAS de una empresa (web, velocidad, reseñas).
Reglas estrictas:
- Usa solo las señales entregadas. Si algo no consta, di que no se pudo verificar; no inventes hechos, cifras ni problemas.
- Una señal ausente en el HTML puede ser un widget cargado por JavaScript: tenlo en cuenta y no lo afirmes como certeza.
- Explica por qué cada hallazgo es un problema u oportunidad para ESE negocio, en español neutro latinoamericano, tono profesional y sobrio.
- Responde únicamente con JSON: {"summary": string (4-6 frases), "extraOpportunities": [{"title","problem","evidenceKeys":[nombres de señales exactos],"consequence","solution","service","impact"}]}.
- extraOpportunities solo si aportan algo que no cubren los hallazgos ya detectados (puede ir vacío). Cada una necesita evidenceKeys reales de las señales.`;

export async function interpretWithClaude(company: Company, observed: Record<string, unknown>, alreadyDetected: string[]): Promise<LlmInterpretation> {
  const user = JSON.stringify({
    empresa: { nombre: company.name, nicho: company.niche, categoria: company.category, ciudad: company.city, rating: company.rating, resenas: company.review_count, web: company.website },
    senales: observed,
    hallazgos_ya_detectados: alreadyDetected,
  });
  const { text, model } = await callClaude(SYSTEM, user);
  const j = extractJson(text) as { summary?: unknown; extraOpportunities?: unknown };
  const summary = typeof j.summary === "string" ? j.summary.trim() : "";
  if (!summary) throw new Error("La respuesta del modelo no incluye resumen");
  const extra = Array.isArray(j.extraOpportunities) ? j.extraOpportunities : [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    summary, model,
    extraOpportunities: extra.slice(0, 3).map((o: any) => ({
      title: str(o?.title), problem: str(o?.problem), evidenceKeys: Array.isArray(o?.evidenceKeys) ? o.evidenceKeys.filter((k: unknown) => typeof k === "string") : [],
      consequence: str(o?.consequence), solution: str(o?.solution), service: str(o?.service), impact: str(o?.impact),
    })).filter((o) => o.title && o.problem && o.solution && o.evidenceKeys.length),
  };
}
