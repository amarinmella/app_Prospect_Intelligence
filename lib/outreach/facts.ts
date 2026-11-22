import type { Company, EvidenceItem, Opportunity } from "../types";
import type { OutreachInput } from "./types";

/** Un dato verificable que el modelo puede citar. Todo lo que el mensaje afirme debe salir de aquí. */
export interface Fact { id: string; text: string; source: string; url?: string }

function host(url: string): string {
  try { return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return url; }
}

export function buildFacts(company: Company, opportunities: Opportunity[]): Fact[] {
  const facts: Fact[] = [];
  const add = (text: string, source: string, url?: string) => facts.push({ id: `F${facts.length + 1}`, text, source, url });
  if (company.rating != null && company.review_count) add(`Tiene valoración ${company.rating} con ${company.review_count} reseñas.`, "Reseñas públicas");
  else if (company.review_count) add(`Tiene ${company.review_count} reseñas públicas.`, "Reseñas públicas");
  if (company.website) add(`Su sitio web es ${host(company.website)}.`, "Directorio", company.website);
  if (company.category) add(`Categoría: ${company.category}.`, "Directorio");
  for (const o of opportunities) {
    for (const e of o.evidence ?? []) add(`${e.text} (relacionado con: ${o.title})`, e.source, e.url);
    add(`Posible oportunidad "${o.title}": ${o.problem} Consecuencia potencial: ${o.consequence}`, "Análisis", undefined);
  }
  return facts;
}

export function factToEvidence(f: Fact): EvidenceItem {
  return { text: f.text, source: f.source, ...(f.url ? { url: f.url } : {}) };
}

/** Texto contra el que se valida cualquier cifra, URL, email o teléfono del mensaje. */
export function buildCorpus(input: Pick<OutreachInput, "company" | "opportunities" | "analysis">, facts: Fact[]): string {
  const c = input.company;
  const parts = [c.name, c.niche, c.category, c.city, c.region, c.country, c.website, c.email, c.phone, c.address,
    ...facts.map((f) => f.text + " " + (f.url ?? "")),
    ...input.opportunities.flatMap((o) => [o.title, o.problem, o.consequence, o.solution, o.service, o.impact, ...(o.evidence ?? []).map((e) => e.text)]),
  ];
  return parts.filter(Boolean).join("\n");
}
