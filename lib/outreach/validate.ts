import type { MessageChannel } from "../types";

/** Límites por canal: mensajes breves, que abren conversación. */
export const CHANNEL_LIMITS: Record<MessageChannel, { maxWords: number; maxChars?: number; maxSubject?: number }> = {
  email: { maxWords: 110, maxSubject: 70 },
  linkedin: { maxWords: 55, maxChars: 300 },
  whatsapp: { maxWords: 60 },
};

const BANNED = [
  /espero que (te )?encuentres bien/i, /espero que est[eé]s bien/i, /me pongo en contacto/i, /somos (l[ií]deres|expertos)/i,
  /garantiz/i, /100\s?%/, /oferta (especial|limitada)/i, /[úu]ltima oportunidad/i, /sin compromiso alguno/i,
  /\{\{|\}\}|\[(nombre|empresa|name|company)[^\]]*\]/i,
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const normNum = (s: string) => s.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
const digits = (s: string) => s.replace(/\D/g, "");

function numbers(s: string): string[] {
  return (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map(normNum).filter(Boolean);
}
function words(s: string): string[] { return s.trim().split(/\s+/).filter(Boolean); }
function significant(s: string): Set<string> {
  return new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 5));
}

export interface ValidationInput {
  channel: MessageChannel; subject?: string; body: string;
  /** Texto de los hechos que el modelo declara haber usado. */
  citedText: string;
  /** Todo lo que consta de la empresa (para validar cifras, enlaces, contactos). */
  corpus: string;
  /** Nombre de quien firma (puede aparecer en el cuerpo sin estar en el corpus). */
  senderName?: string;
}

/** Devuelve lista de problemas; vacía = válido. */
export function validateDraft(v: ValidationInput): string[] {
  const issues: string[] = [];
  const lim = CHANNEL_LIMITS[v.channel];
  const body = v.body.trim();
  if (!body) return ["El cuerpo está vacío."];

  const wc = words(body).length;
  if (wc > lim.maxWords) issues.push(`Demasiado largo: ${wc} palabras (máximo ${lim.maxWords}).`);
  if (lim.maxChars && body.length > lim.maxChars) issues.push(`Demasiado largo: ${body.length} caracteres (máximo ${lim.maxChars}).`);
  if (v.channel === "email") {
    if (!v.subject?.trim()) issues.push("Falta el asunto.");
    else if (v.subject.length > (lim.maxSubject ?? 70)) issues.push(`Asunto demasiado largo (máximo ${lim.maxSubject} caracteres).`);
  }
  for (const re of BANNED) if (re.test(body) || (v.subject && re.test(v.subject))) issues.push(`Frase genérica o placeholder no permitido (${re.source.slice(0, 30)}).`);

  const full = `${v.subject ?? ""}\n${body}`;
  const corpusNums = new Set(numbers(v.corpus));
  for (const n of new Set(numbers(full))) if (!corpusNums.has(n)) issues.push(`La cifra "${n}" no consta en la evidencia.`);

  const corpusN = norm(v.corpus);
  const corpusDigits = digits(v.corpus);
  for (const e of full.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) if (!corpusN.includes(norm(e))) issues.push(`El email "${e}" no consta en los datos.`);
  for (const u of full.match(/(?:https?:\/\/|www\.)[^\s)]+/gi) ?? []) {
    const h = norm(u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[.,;]+$/, "")).split("/")[0]!;
    if (!corpusN.includes(h)) issues.push(`El enlace "${u}" no consta en los datos.`);
  }
  for (const p of full.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []) if (!corpusDigits.includes(digits(p))) issues.push(`El teléfono "${p.trim()}" no consta en los datos.`);

  // Debe apoyarse en algo concreto de lo citado (no basta con el nombre de la empresa).
  const cited = significant(v.citedText);
  const bodyWords = significant(full);
  const overlap = [...cited].filter((w) => bodyWords.has(w));
  if (!v.citedText.trim() || overlap.length < 2) issues.push("El mensaje no refleja ningún dato concreto de los hechos citados.");

  // Pregunta/apertura de conversación.
  if (!/[?¿]/.test(body)) issues.push("Debe terminar abriendo conversación (incluye una pregunta).");
  return issues;
}

/** Cifras de `text` que no constan en `corpus` (para validar textos largos como el informe). */
export function unsupportedNumbers(text: string, corpus: string): string[] {
  const ok = new Set(numbers(corpus));
  return [...new Set(numbers(text))].filter((n) => !ok.has(n));
}
