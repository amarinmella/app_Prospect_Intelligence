import type { Analysis, Company, CompanyScore, Opportunity } from "../types";

/**
 * CONTRATO · Informe comercial.
 * build() produce el contenido estructurado (se guarda en reports.content);
 * renderPdf() lo convierte en PDF presentable a un cliente.
 */
export interface ReportContent {
  title: string;
  generatedAt: string;
  situation: string;
  problems: { title: string; detail: string }[];
  evidence: { text: string; source: string; url?: string }[];
  opportunities: { title: string; solution: string; impact: string }[];
  recommendations: string[];
  proposedSystems: string[];
  potentialImpact: string;
  /** Opcional: puntuación heurística y su desglose (para mostrarla con transparencia en el PDF). */
  score?: { total: number; confidence: string; method: string; factors: { factor: string; points: number; weight: number; explanation: string }[] };
  /** Opcional: "claude" si recomendaciones/impacto fueron redactados por el modelo, "datos" si se derivaron directamente del análisis. */
  narrative?: "claude" | "datos";
}
export interface ReportInput {
  company: Company;
  analysis: Analysis | null;
  opportunities: Opportunity[];
  score: CompanyScore | null;
}
export interface ReportBuilder {
  build(input: ReportInput): Promise<ReportContent>;
  renderPdf(content: ReportContent, company: Company): Promise<Uint8Array>;
}
