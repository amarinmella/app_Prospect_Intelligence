import type { Confidence, ScoreFactor } from "../types";
import type { ScoreFn } from "./types";

export const SCORE_METHOD = "heuristic-v1";
const CONF: Record<Confidence, number> = { low: 0.35, medium: 0.7, high: 1 };
const DIGITAL_KEYS = /^(no_website|website_unreachable|no_mobile_viewport|slow_site|weak_cta|no_tracking|no_socials|no_lead_capture|heavy_form)$/;

const factor = (name: string, weight: number, ratio: number, explanation: string): ScoreFactor => {
  const points = Math.round(weight * Math.max(0, Math.min(1, ratio)));
  return { factor: name, weight, points, explanation };
};

/**
 * Puntuación HEURÍSTICA (0-100) para priorizar, no una medida científica: suma 7 factores con pesos fijos
 * y cada uno explica su aporte. Sube la nota cuando hay problemas graves y justificados en un negocio con
 * actividad real y fácil de contactar.
 */
export const scoreCompany: ScoreFn = ({ company, opportunities, hasAnalysis }) => {
  const n = opportunities.length;
  const maxSev = n ? Math.max(...opportunities.map((o) => o.severity)) : 0;
  const avgSev = n ? opportunities.reduce((a, o) => a + o.severity, 0) / n : 0;
  const reviews = company.review_count ?? 0;
  const digital = opportunities.filter((o) => DIGITAL_KEYS.test(o.problem_key)).length;
  const highImpact = opportunities.filter((o) => o.impact_level === "high").length;
  const avgConf = n ? opportunities.reduce((a, o) => a + CONF[o.confidence], 0) / n : 0;
  const hasSocial = Object.values(company.socials ?? {}).some(Boolean);

  const breakdown: ScoreFactor[] = [
    factor("Severidad de los problemas", 30, (maxSev * 0.6 + avgSev * 0.4) / 5, n ? `Problema más grave: ${maxSev}/5; severidad media ${avgSev.toFixed(1)}/5.` : "No hay problemas detectados."),
    factor("Número de oportunidades", 15, n / 6, `${n} oportunidad(es) detectada(s); el máximo puntúa con 6 o más.`),
    factor("Tamaño y actividad", 15, Math.log10(1 + reviews) / Math.log10(1 + 500), company.review_count == null ? "Sin dato de reseñas; no se puede estimar la actividad." : `${reviews} reseñas como indicador aproximado de actividad (escala logarítmica, tope 500).`),
    factor("Brecha de presencia digital", 10, digital / 3, `${digital} carencia(s) de presencia/captación digital (web, móvil, CTA, seguimiento).`),
    factor("Facilidad de contacto", 10, (company.email ? 0.4 : 0) + (company.phone ? 0.3 : 0) + (company.website ? 0.2 : 0) + (hasSocial ? 0.1 : 0),
      `Email ${company.email ? "sí" : "no"}, teléfono ${company.phone ? "sí" : "no"}, web ${company.website ? "sí" : "no"}, redes ${hasSocial ? "sí" : "no"}.`),
    factor("Potencial económico", 10, highImpact / 2 + (reviews >= 100 ? 0.25 : 0), `${highImpact} oportunidad(es) de impacto alto${reviews >= 100 ? " y volumen de reseñas alto" : ""}. Estimación cualitativa, no ingresos reales.`),
    factor("Confianza del análisis", 10, hasAnalysis ? avgConf : 0, hasAnalysis ? `Confianza media de los hallazgos: ${(avgConf * 100).toFixed(0)}%.` : "Aún no hay análisis."),
  ];
  const total = Math.max(0, Math.min(100, breakdown.reduce((a, f) => a + f.points, 0)));
  const confidence: Confidence = !hasAnalysis || n === 0 ? "low" : avgConf >= 0.8 ? "high" : avgConf >= 0.5 ? "medium" : "low";
  return { total, confidence, breakdown, method: SCORE_METHOD };
};
