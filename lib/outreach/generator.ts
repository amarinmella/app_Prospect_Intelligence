import type { MessageChannel } from "../types";
import { claudeJson } from "./claude";
import { buildCorpus, buildFacts, factToEvidence, type Fact } from "./facts";
import { CHANNEL_LIMITS, validateDraft } from "./validate";
import type { OutreachDraft, OutreachGenerator, OutreachInput } from "./types";

export class OutreachValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`El mensaje generado no superó la validación anti-invención: ${issues.join(" · ")}`);
    this.name = "OutreachValidationError";
  }
}

const CHANNEL_GUIDE: Record<MessageChannel, string> = {
  email: `Email frío: asunto corto y concreto (sin mayúsculas gritonas ni "oferta"); cuerpo de 3-5 frases, máximo ${CHANNEL_LIMITS.email.maxWords} palabras. Sin firma (se añade aparte).`,
  linkedin: `Nota de conexión/mensaje de LinkedIn: máximo ${CHANNEL_LIMITS.linkedin.maxChars} caracteres, 2-3 frases, sin asunto, tono de colega.`,
  whatsapp: `WhatsApp: informal-profesional, 2-3 frases, máximo ${CHANNEL_LIMITS.whatsapp.maxWords} palabras, sin asunto, sin emojis salvo que sea natural (máximo uno).`,
};

const SYSTEM = `Escribes mensajes de primer contacto para Innova IA Studio, una consultora de IA y automatización para negocios.
Español neutro latinoamericano, tuteo respetuoso, humano y sobrio. No suenes a plantilla ni a vendedor.
Reglas estrictas:
- Te entrego HECHOS numerados (F1, F2...). Solo puedes afirmar cosas que estén en esos hechos. No inventes cifras, nombres de personas, servicios que ofrece el negocio, resultados ni datos de contacto.
- Menciona al menos un hecho específico del negocio y, si la evidencia lo respalda, un posible problema u oportunidad formulado como observación o duda, con prudencia ("me pareció ver que...", "no logré encontrar...") porque el análisis es automático y puede errar.
- No vendas directamente: no menciones precios ni propongas "una demo"; abre conversación con una pregunta breve y fácil de responder.
- Breve. Sin frases de relleno ("espero que estés bien", "me pongo en contacto"). Sin adjetivos grandilocuentes.
- No te presentes con cifras ni logros inventados de Innova IA Studio.
Devuelve solo JSON: {"subject": string (vacío si no es email), "body": string, "factIds": [ids de los hechos en que te apoyaste, mínimo 1]}.`;

const SCHEMA = {
  type: "object",
  properties: { subject: { type: "string" }, body: { type: "string" }, factIds: { type: "array", items: { type: "string" } } },
  required: ["subject", "body", "factIds"],
  additionalProperties: false,
};

interface Raw { subject: string; body: string; factIds: string[] }

function senderName(): string { return process.env.OUTREACH_SENDER_NAME?.trim() || "Innova IA Studio"; }

export const outreachGenerator: OutreachGenerator = {
  async generate(input: OutreachInput): Promise<OutreachDraft> {
    const { company, opportunities, channel } = input;
    const facts = buildFacts(company, opportunities);
    if (facts.length < 2) {
      throw new Error("No hay evidencia suficiente para un mensaje personalizado. Analiza la empresa primero (se necesitan hechos reales).");
    }
    const corpus = buildCorpus(input, facts);
    const byId = new Map(facts.map((f) => [f.id, f] as const));
    const userBase = JSON.stringify({
      canal: channel, guia_del_canal: CHANNEL_GUIDE[channel],
      empresa: { nombre: company.name, nicho: company.niche, ciudad: company.city },
      resumen_del_analisis: input.analysis?.summary ?? null,
      hechos: facts.map((f) => ({ id: f.id, hecho: f.text })),
    });

    let feedback = "";
    let lastIssues: string[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data } = await claudeJson<Raw>({ system: SYSTEM, user: userBase + feedback, schema: SCHEMA, maxTokens: 3000 });
      const issues = checkOne(data, input, facts, corpus, byId);
      if (!issues.length) return toDraft(data, channel, byId);
      lastIssues = issues;
      feedback = `\n\nTu intento anterior fue rechazado por: ${issues.join("; ")}. Corrígelo usando solo los hechos entregados.`;
    }
    throw new OutreachValidationError(lastIssues);
  },
};

function checkOne(d: Raw, input: OutreachInput, facts: Fact[], corpus: string, byId: Map<string, Fact>): string[] {
  const ids = Array.isArray(d.factIds) ? d.factIds : [];
  const unknown = ids.filter((id) => !byId.has(id));
  const issues: string[] = [];
  if (!ids.length) issues.push("No citaste ningún hecho (factIds vacío)");
  if (unknown.length) issues.push(`factIds inexistentes: ${unknown.join(", ")}`);
  issues.push(...validateDraft({
    channel: input.channel, subject: d.subject, body: String(d.body ?? ""),
    citedText: ids.map((id) => byId.get(id)?.text ?? "").join(" "), corpus, senderName: senderName(),
  }));
  return issues;
}

function toDraft(d: Raw, channel: MessageChannel, byId: Map<string, Fact>): OutreachDraft {
  let body = d.body.trim();
  if (channel === "email") body += `\n\n${senderName()}`;
  return {
    channel, ...(channel === "email" ? { subject: d.subject.trim() } : {}), body,
    evidenceUsed: [...new Set(d.factIds)].map((id) => factToEvidence(byId.get(id)!)),
  };
}
