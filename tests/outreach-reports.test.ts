import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { validateDraft } from "../lib/outreach/validate";
import { buildFacts } from "../lib/outreach/facts";
import { outreachGenerator, OutreachValidationError } from "../lib/outreach";
import { NotConfiguredError } from "../lib/errors";
import { buildReport, buildFromData } from "../lib/reports/builder";
import { reportBuilder } from "../lib/reports";
import type { Analysis, Company, CompanyScore, Opportunity } from "../lib/types";

const company: Company = {
  id: "c1", search_id: null, name: "Clínica Sonrisa", niche: "clínica dental", category: "Dentista", website: "https://www.sonrisa.test", address: null, city: "Madrid", region: null, country: "ES",
  lat: null, lng: null, phone: "+34 600 111 222", email: null, rating: 4.6, review_count: 87, opening_hours: null, socials: {}, description: null, size_hint: null, crm_status: "analyzed",
  owner: null, next_action: null, follow_up_date: null, score: 72, score_confidence: "medium", opportunity_count: 1, analyzed_at: null, created_at: "", updated_at: "",
};
const opp: Opportunity = {
  id: "o1", company_id: "c1", analysis_id: "a1", problem_key: "no_whatsapp", title: "Sin WhatsApp visible", problem: "La web no ofrece WhatsApp para pedir cita.",
  evidence: [{ text: "No se encontró ningún enlace a WhatsApp en la página de inicio ni en contacto.", source: "Web sonrisa.test" }],
  consequence: "Pacientes que prefieren mensajería pueden abandonar.", solution: "Botón de WhatsApp con respuesta automática y agenda.", service: "Automatización de WhatsApp",
  impact: "Más citas captadas fuera de horario.", impact_level: "medium", severity: 4, confidence: "medium", created_at: "",
};
const analysis: Analysis = { id: "a1", company_id: "c1", summary: "Web clara pero sin canales de mensajería.", signals: {}, website_snapshot: null, model: null, confidence: "medium", created_at: "" };
const score: CompanyScore = { id: "s1", company_id: "c1", total: 72, confidence: "medium", method: "heurístico v1", created_at: "", breakdown: [{ factor: "Severidad", weight: 30, points: 24, explanation: "Un problema de severidad alta." }] };

const goodBody = "Hola, vi que Clínica Sonrisa tiene 87 reseñas con valoración 4.6 y no logré encontrar un botón de WhatsApp en su web. ¿Cómo gestionan hoy las solicitudes de cita fuera de horario?";
const corpus = "Clínica Sonrisa 87 reseñas 4.6 No se encontró ningún enlace a WhatsApp en la página de inicio ni en contacto https://www.sonrisa.test";
const cited = "Tiene valoración 4.6 con 87 reseñas. No se encontró ningún enlace a WhatsApp en la página de inicio ni en contacto.";

test("validateDraft acepta un mensaje basado en hechos", () => {
  assert.deepEqual(validateDraft({ channel: "whatsapp", body: goodBody, citedText: cited, corpus }), []);
});
test("validateDraft rechaza cifras, enlaces, emails y teléfonos inventados", () => {
  const bad = (b: string) => validateDraft({ channel: "whatsapp", body: b, citedText: cited, corpus });
  assert.ok(bad(goodBody + " Subimos un 40% las citas.").some((i) => i.includes("40")));
  assert.ok(bad(goodBody + " Mira https://otra.example").some((i) => i.includes("enlace")));
  assert.ok(bad(goodBody + " Escríbeme a juan@x.com").some((i) => i.includes("email")));
  assert.ok(bad(goodBody + " Llama al 612 345 678").some((i) => i.includes("teléfono")));
});
test("validateDraft rechaza genéricos, largos, sin pregunta y sin dato concreto", () => {
  assert.ok(validateDraft({ channel: "whatsapp", body: "Espero que estés bien. " + goodBody, citedText: cited, corpus }).length);
  assert.ok(validateDraft({ channel: "linkedin", body: goodBody + " ".repeat(5) + "x".repeat(300), citedText: cited, corpus }).some((i) => i.includes("largo")));
  assert.ok(validateDraft({ channel: "whatsapp", body: "Hola, Clínica Sonrisa.", citedText: cited, corpus }).length);
  assert.ok(validateDraft({ channel: "email", body: goodBody, citedText: cited, corpus }).some((i) => i.includes("asunto")));
});

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; delete process.env.ANTHROPIC_API_KEY; });
function mockClaude(...outputs: unknown[]) {
  let i = 0;
  process.env.ANTHROPIC_API_KEY = "test-key";
  globalThis.fetch = (async () => new Response(JSON.stringify({
    id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "end_turn", stop_sequence: null,
    content: [{ type: "text", text: JSON.stringify(outputs[Math.min(i++, outputs.length - 1)]) }], usage: { input_tokens: 1, output_tokens: 1 },
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  return () => i;
}
const input = (channel: "email" | "whatsapp" = "whatsapp") => ({ company, analysis, opportunities: [opp], channel });

test("generate sin ANTHROPIC_API_KEY lanza NotConfiguredError claro", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await assert.rejects(outreachGenerator.generate(input()), (e: unknown) => e instanceof NotConfiguredError && e.missingEnv[0] === "ANTHROPIC_API_KEY");
});
test("generate devuelve borrador con evidencia real citada", async () => {
  mockClaude({ subject: "", body: goodBody, factIds: ["F1", "F3"] });
  const facts = buildFacts(company, [opp]);
  assert.ok(facts.find((f) => f.id === "F3"));
  const d = await outreachGenerator.generate(input());
  assert.equal(d.channel, "whatsapp");
  assert.equal(d.evidenceUsed.length, 2);
});
test("generate reintenta ante invención y finalmente la rechaza", async () => {
  const bad = { subject: "", body: goodBody + " Ahorramos 3000 euros.", factIds: ["F1", "F3"] };
  const calls = mockClaude(bad);
  await assert.rejects(outreachGenerator.generate(input()), OutreachValidationError);
  assert.equal(calls(), 3);
});
test("generate corrige tras el feedback y añade firma en email", async () => {
  mockClaude({ subject: "Citas", body: goodBody + " 99%", factIds: ["F1", "F3"] }, { subject: "Citas fuera de horario", body: goodBody, factIds: ["F1", "F3"] });
  const d = await outreachGenerator.generate(input("email"));
  assert.equal(d.subject, "Citas fuera de horario");
  assert.match(d.body, /Innova IA Studio$/);
});

test("informe sin API key se deriva solo de los datos del análisis", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const r = await buildReport({ company, analysis, opportunities: [opp], score });
  assert.equal(r.narrative, "datos");
  assert.match(r.situation, /sin canales de mensajería/);
  assert.equal(r.problems.length, 1);
  assert.deepEqual(r.proposedSystems, ["Automatización de WhatsApp"]);
  assert.equal(r.score?.total, 72);
  await assert.rejects(buildReport({ company, analysis: null, opportunities: [], score: null }), /Analiza|Analízala/);
});
test("informe con Claude usa su redacción y rechaza cifras inventadas", async () => {
  mockClaude({ recommendations: ["Instalar WhatsApp con agenda."], potentialImpact: "Mejor captación fuera de horario." });
  assert.equal((await buildReport({ company, analysis, opportunities: [opp], score })).narrative, "claude");
  mockClaude({ recommendations: ["Aumentar ventas un 300%."], potentialImpact: "x" });
  assert.equal((await buildReport({ company, analysis, opportunities: [opp], score })).narrative, "datos");
});
test("renderPdf produce un PDF válido con el contenido y la firma", async () => {
  const pdf = await reportBuilder.renderPdf(buildFromData({ company, analysis, opportunities: [opp], score }), company);
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
  assert.ok(pdf.length > 2000);
});
