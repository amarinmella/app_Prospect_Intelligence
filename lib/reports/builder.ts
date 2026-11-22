import { claudeJson, hasAnthropicKey } from "../outreach/claude";
import { unsupportedNumbers } from "../outreach/validate";
import { CONFIDENCE_LABELS, type Opportunity } from "../types";
import type { ReportContent, ReportInput } from "./types";

const SYSTEM = `Eres consultor comercial senior de Innova IA Studio (IA y automatización). Redactas la parte de recomendaciones de un informe que se mostrará al cliente.
Reglas estrictas:
- Usa SOLO los datos entregados. No inventes cifras, porcentajes, ahorros, ingresos ni plazos. Si no hay dato, habla en términos cualitativos y prudentes.
- El análisis es automático y público: formula con prudencia ("según lo observado públicamente").
- Español neutro latinoamericano, tono profesional y claro, sin tecnicismos innecesarios.
Devuelve solo JSON: {"recommendations": [3 a 5 frases accionables, ordenadas por prioridad], "potentialImpact": string (2-4 frases, cualitativo, sin cifras inventadas)}.`;

const SCHEMA = {
  type: "object",
  properties: { recommendations: { type: "array", items: { type: "string" } }, potentialImpact: { type: "string" } },
  required: ["recommendations", "potentialImpact"],
  additionalProperties: false,
};

const IMPACT_NOTE = "Las estimaciones son cualitativas y se basan en información pública y heurísticas; deben validarse con datos internos del negocio.";

function sorted(opps: Opportunity[]) { return [...opps].sort((a, b) => b.severity - a.severity); }

/** Contenido derivado directamente del análisis, sin texto generado. */
export function buildFromData(input: ReportInput): ReportContent {
  const { company, analysis, score } = input;
  const opps = sorted(input.opportunities);
  const situationParts = [
    analysis?.summary?.trim(),
    company.rating != null && company.review_count ? `Cuenta con una valoración de ${company.rating} sobre ${company.review_count} reseñas públicas.` : null,
  ].filter(Boolean) as string[];
  return {
    title: `Informe comercial · ${company.name}`,
    generatedAt: new Date().toISOString(),
    situation: situationParts.join(" "),
    problems: opps.map((o) => ({ title: o.title, detail: `${o.problem} ${o.consequence}`.trim() })),
    evidence: opps.flatMap((o) => (o.evidence ?? []).map((e) => ({ text: e.text, source: e.source, ...(e.url ? { url: e.url } : {}) }))),
    opportunities: opps.map((o) => ({ title: o.title, solution: o.solution, impact: `${o.impact} (impacto ${CONFIDENCE_LABELS[o.impact_level].toLowerCase()}, confianza ${CONFIDENCE_LABELS[o.confidence].toLowerCase()})` })),
    recommendations: opps.slice(0, 5).map((o) => o.solution),
    proposedSystems: [...new Set(opps.map((o) => o.service).filter(Boolean))],
    potentialImpact: `${opps.slice(0, 3).map((o) => o.impact).join(" ")} ${IMPACT_NOTE}`.trim(),
    narrative: "datos",
    ...(score ? { score: { total: score.total, confidence: CONFIDENCE_LABELS[score.confidence], method: score.method, factors: score.breakdown.map((f) => ({ factor: f.factor, points: f.points, weight: f.weight, explanation: f.explanation })) } } : {}),
  };
}

export async function buildReport(input: ReportInput): Promise<ReportContent> {
  if (!input.opportunities.length && !input.analysis) {
    throw new Error("No hay análisis ni oportunidades para esta empresa. Analízala antes de generar el informe.");
  }
  const base = buildFromData(input);
  if (!hasAnthropicKey() || !base.problems.length) return base;

  const data = {
    empresa: { nombre: input.company.name, nicho: input.company.niche, ciudad: input.company.city, web: input.company.website, rating: input.company.rating, resenas: input.company.review_count },
    resumen: input.analysis?.summary ?? null,
    oportunidades: input.opportunities.map((o) => ({ titulo: o.title, problema: o.problem, evidencia: (o.evidence ?? []).map((e) => e.text), consecuencia: o.consequence, solucion: o.solution, servicio: o.service, impacto: o.impact, confianza: o.confidence })),
  };
  const corpus = JSON.stringify(data);
  let feedback = "";
  for (let i = 0; i < 2; i++) {
    try {
      const { data: out } = await claudeJson<{ recommendations: string[]; potentialImpact: string }>({ system: SYSTEM, user: JSON.stringify(data) + feedback, schema: SCHEMA, maxTokens: 3000 });
      const text = [...(out.recommendations ?? []), out.potentialImpact ?? ""].join("\n");
      const bad = unsupportedNumbers(text, corpus);
      if (bad.length) { feedback = `\n\nRechazado: las cifras ${bad.join(", ")} no constan en los datos. No uses cifras que no estén entregadas.`; continue; }
      if (!out.recommendations?.length || !out.potentialImpact?.trim()) continue;
      return { ...base, recommendations: out.recommendations, potentialImpact: `${out.potentialImpact.trim()} ${IMPACT_NOTE}`, narrative: "claude" };
    } catch { break; } // fallo del modelo: el informe sigue siendo válido con los datos del análisis
  }
  return base;
}
