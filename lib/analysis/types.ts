import type { Company, Confidence, EvidenceItem } from "../types";

/**
 * CONTRATO · Análisis web + detección de oportunidades.
 * 1) WebsiteAnalyzer: observa (fetch real de la web, HTML, señales técnicas) e interpreta (resumen).
 * 2) OpportunityDetector: convierte el análisis en oportunidades justificadas con evidencia.
 * Regla: no se inventan problemas; cada oportunidad lleva evidencia verificable.
 */
export interface WebsiteAnalysis {
  summary: string;                         // interpretación en lenguaje natural
  signals: Record<string, unknown>;        // hallazgos estructurados (cta, formularios, whatsapp, reservas, chat, móvil, velocidad...)
  snapshot: Record<string, unknown> | null; // {url, status, fetchedAt, loadMs, ...}
  model: string | null;
  confidence: Confidence;
}

export interface OpportunityDraft {
  problemKey: string;
  title: string;
  problem: string;
  evidence: EvidenceItem[];
  consequence: string;
  solution: string;
  service: string;
  impact: string;
  impactLevel: Confidence;
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: Confidence;
}

export interface WebsiteAnalyzer {
  analyze(company: Company): Promise<WebsiteAnalysis>;
}
export interface OpportunityDetector {
  detect(company: Company, analysis: WebsiteAnalysis): Promise<OpportunityDraft[]>;
}
