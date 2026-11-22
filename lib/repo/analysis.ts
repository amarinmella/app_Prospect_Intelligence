import "server-only";
import { query, queryOne } from "../db/client";
import type { Analysis, CompanyScore, Message, Note, Opportunity, Report } from "../types";
import type { WebsiteAnalysis, OpportunityDraft } from "../analysis/types";
import type { ScoreResult } from "../scoring/types";
import type { OutreachDraft } from "../outreach/types";
import type { ReportContent } from "../reports/types";
import { logActivity } from "./activity";

export async function latestAnalysis(companyId: string) {
  return queryOne<Analysis>("select * from analyses where company_id = $1 order by created_at desc limit 1", [companyId]);
}
export async function listOpportunities(companyId: string) {
  return query<Opportunity>("select * from opportunities where company_id = $1 order by severity desc, created_at", [companyId]);
}
export async function latestScore(companyId: string) {
  return queryOne<CompanyScore>("select * from company_scores where company_id = $1 order by created_at desc limit 1", [companyId]);
}
export async function listMessages(companyId: string) {
  return query<Message>("select * from messages where company_id = $1 order by created_at desc", [companyId]);
}
export async function listReports(companyId: string) {
  return query<Report>("select * from reports where company_id = $1 order by created_at desc", [companyId]);
}
export async function getReport(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return queryOne<Report>("select * from reports where id = $1", [id]);
}
export async function listNotes(companyId: string) {
  return query<Note>("select * from notes where company_id = $1 order by created_at desc", [companyId]);
}
export async function addNote(companyId: string, body: string, author?: string | null) {
  await query("insert into notes (company_id, body, author) values ($1,$2,$3)", [companyId, body, author ?? null]);
  await logActivity({ companyId, type: "note_added", description: "Nota añadida" });
}

/** Guarda análisis + oportunidades (reemplaza las anteriores) y marca la empresa como analizada. */
export async function saveAnalysis(companyId: string, a: WebsiteAnalysis, opps: OpportunityDraft[]): Promise<void> {
  const row = await queryOne<{ id: string }>(
    `insert into analyses (company_id, summary, signals, website_snapshot, model, confidence)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [companyId, a.summary, JSON.stringify(a.signals), a.snapshot ? JSON.stringify(a.snapshot) : null, a.model, a.confidence]);
  await query("delete from opportunities where company_id = $1", [companyId]);
  for (const o of opps) {
    await query(
      `insert into opportunities (company_id, analysis_id, problem_key, title, problem, evidence, consequence, solution, service, impact, impact_level, severity, confidence)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [companyId, row!.id, o.problemKey, o.title, o.problem, JSON.stringify(o.evidence), o.consequence, o.solution, o.service, o.impact, o.impactLevel, o.severity, o.confidence]);
  }
  await query(
    `update companies set analyzed_at = now(), opportunity_count = $2,
       crm_status = case when crm_status = 'new' then 'analyzed'::crm_status else crm_status end where id = $1`,
    [companyId, opps.length]);
  await logActivity({ companyId, type: "analysis_done", description: `Análisis completado (${opps.length} oportunidades)` });
}

export async function saveScore(companyId: string, s: ScoreResult): Promise<void> {
  await query("insert into company_scores (company_id, total, confidence, breakdown, method) values ($1,$2,$3,$4,$5)",
    [companyId, s.total, s.confidence, JSON.stringify(s.breakdown), s.method]);
  await query("update companies set score = $2, score_confidence = $3 where id = $1", [companyId, s.total, s.confidence]);
}

export async function saveMessage(companyId: string, m: OutreachDraft) {
  await query("insert into messages (company_id, channel, subject, body, evidence_used) values ($1,$2,$3,$4,$5)",
    [companyId, m.channel, m.subject ?? null, m.body, JSON.stringify(m.evidenceUsed)]);
  await logActivity({ companyId, type: "message_generated", description: `Mensaje generado (${m.channel})` });
}

export async function saveReport(companyId: string, content: ReportContent, pdfPath?: string | null) {
  const r = await queryOne<{ id: string }>("insert into reports (company_id, title, content, pdf_path) values ($1,$2,$3,$4) returning id",
    [companyId, content.title, JSON.stringify(content), pdfPath ?? null]);
  await logActivity({ companyId, type: "report_generated", description: "Informe comercial generado" });
  return r!.id;
}
