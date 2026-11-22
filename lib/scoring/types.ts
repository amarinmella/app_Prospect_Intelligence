import type { Company, Confidence, Opportunity, ScoreFactor } from "../types";

/**
 * CONTRATO · Puntuación de oportunidad (0-100). Es una HEURÍSTICA, no una medida científica:
 * cada factor debe explicarse en lenguaje natural para que se pueda auditar desde la ficha.
 */
export interface ScoreResult {
  total: number;               // 0..100
  confidence: Confidence;
  breakdown: ScoreFactor[];    // suma de points == total
  method: string;              // p.ej. "heuristic-v1"
}
export interface ScoreInput {
  company: Company;
  opportunities: Opportunity[];
  hasAnalysis: boolean;
}
export type ScoreFn = (input: ScoreInput) => ScoreResult;
