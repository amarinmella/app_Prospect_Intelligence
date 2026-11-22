import "server-only";
import { discover } from "../discovery";
import { websiteAnalyzer, opportunityDetector } from "../analysis";
import { scoreCompany } from "../scoring";
import { outreachGenerator } from "../outreach";
import { reportBuilder } from "../reports";
import { errorMessage, NotConfiguredError, NotImplementedYetError } from "../errors";
import { getCompany, insertDiscovered } from "../repo/companies";
import { getSearch, setSearchState } from "../repo/searches";
import { latestAnalysis, listOpportunities, latestScore, saveAnalysis, saveScore, saveMessage, saveReport } from "../repo/analysis";
import { logActivity } from "../repo/activity";
import type { MessageChannel } from "../types";

/** Resultado uniforme para la UI: ok, o bloqueo (falta configuración / módulo pendiente), o error. */
export type StepResult = { ok: true; message: string } | { ok: false; kind: "blocked" | "pending" | "error"; message: string };

function fail(e: unknown): StepResult {
  if (e instanceof NotConfiguredError) return { ok: false, kind: "blocked", message: e.message };
  if (e instanceof NotImplementedYetError) return { ok: false, kind: "pending", message: e.message };
  return { ok: false, kind: "error", message: errorMessage(e) };
}

export async function runSearch(searchId: string): Promise<StepResult> {
  const s = await getSearch(searchId);
  if (!s) return { ok: false, kind: "error", message: "Búsqueda no encontrada" };
  await setSearchState(searchId, { status: "running" });
  try {
    const { provider, companies } = await discover({ niche: s.niche, location: s.location, limit: s.target_count });
    const n = await insertDiscovered(searchId, s.niche, provider.id, companies.slice(0, s.target_count));
    await setSearchState(searchId, { status: "completed", provider: provider.id, found_count: n });
    await logActivity({ searchId, type: "search_completed", description: `Búsqueda completada: ${n} empresas nuevas (${provider.label})` });
    return { ok: true, message: `${n} empresas nuevas añadidas desde ${provider.label}.` };
  } catch (e) {
    const r = fail(e);
    await setSearchState(searchId, { status: "failed", error: r.ok ? null : r.message });
    return r;
  }
}

export async function analyzeCompany(companyId: string): Promise<StepResult> {
  const c = await getCompany(companyId);
  if (!c) return { ok: false, kind: "error", message: "Empresa no encontrada" };
  try {
    const analysis = await websiteAnalyzer.analyze(c);
    const drafts = await opportunityDetector.detect(c, analysis);
    await saveAnalysis(companyId, analysis, drafts);
    const fresh = (await getCompany(companyId))!;
    const opps = await listOpportunities(companyId);
    await saveScore(companyId, scoreCompany({ company: fresh, opportunities: opps, hasAnalysis: true }));
    return { ok: true, message: `Análisis completado: ${drafts.length} oportunidades.` };
  } catch (e) {
    return fail(e);
  }
}

export async function generateMessage(companyId: string, channel: MessageChannel): Promise<StepResult> {
  const c = await getCompany(companyId);
  if (!c) return { ok: false, kind: "error", message: "Empresa no encontrada" };
  try {
    const draft = await outreachGenerator.generate({ company: c, analysis: await latestAnalysis(companyId), opportunities: await listOpportunities(companyId), channel });
    await saveMessage(companyId, draft);
    return { ok: true, message: "Mensaje generado." };
  } catch (e) {
    return fail(e);
  }
}

export async function generateReport(companyId: string): Promise<StepResult> {
  const c = await getCompany(companyId);
  if (!c) return { ok: false, kind: "error", message: "Empresa no encontrada" };
  try {
    const content = await reportBuilder.build({ company: c, analysis: await latestAnalysis(companyId), opportunities: await listOpportunities(companyId), score: await latestScore(companyId) });
    await saveReport(companyId, content);
    return { ok: true, message: "Informe generado." };
  } catch (e) {
    return fail(e);
  }
}
