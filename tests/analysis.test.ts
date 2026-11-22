import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSignals, findContactLinks } from "../lib/analysis/signals";
import { detectRules, opportunityDetector } from "../lib/analysis/detector";
import { assessReputation } from "../lib/analysis/reputation";
import { assertPublicUrl, FetchBlockedError } from "../lib/analysis/safe-fetch";
import { extractJson } from "../lib/analysis/llm";
import { scoreCompany } from "../lib/scoring";
import type { AnalysisSignals } from "../lib/analysis/analyzer";
import type { Company, Opportunity } from "../lib/types";

const company = (o: Partial<Company> = {}): Company => ({
  id: "c1", search_id: null, name: "Clínica Demo", niche: "clínica dental", category: "Dentista", website: "https://demo.test", address: null, city: "Madrid", region: null, country: "ES",
  lat: null, lng: null, phone: "+34 600 000 000", email: null, rating: 4.7, review_count: 120, opening_hours: null, socials: {}, description: null, size_hint: null, crm_status: "new",
  owner: null, next_action: null, follow_up_date: null, score: null, score_confidence: null, opportunity_count: 0, analyzed_at: null, created_at: "", updated_at: "", ...o,
});

const BASIC = `<html lang="es"><head><title>Clínica Demo</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>Dentistas en Madrid</h1>
<a href="/contacto">Contacto</a><p>${"texto ".repeat(100)}</p></body></html>`;
const RICH = `<html><head><title>X</title><meta name="viewport" content="width=device-width"><script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script><script src="//js.hs-scripts.com/1.js"></script></head>
<body><a href="https://wa.me/34600000000">Escríbenos por WhatsApp</a><a href="https://calendly.com/demo">Pedir cita</a><a href="https://instagram.com/demo">ig</a>
<form action="/send"><input name="email"><input name="tel"><textarea></textarea></form><script src="https://client.crisp.chat/l.js"></script><a href="mailto:Info@Demo.test">mail</a></body></html>`;
const sig = (html: string) => extractSignals([{ url: "https://demo.test/", status: 200, html, loadMs: 500 }]);
const wrap = (website: ReturnType<typeof sig>, extra: Partial<AnalysisSignals> = {}, c = company()): AnalysisSignals => ({
  website, pagespeed: null, reputation: assessReputation(c), llm: { used: false, error: null, extraOpportunities: [] }, ...extra,
});

test("extractSignals detecta WhatsApp, reservas, chat, formularios, píxeles y emails", () => {
  const s = sig(RICH);
  assert.equal(s.whatsapp.detected, true);
  assert.equal(s.booking.provider, "Calendly");
  assert.equal(s.chat.provider, "Crisp");
  assert.equal(s.forms.length, 1);
  assert.equal(s.forms[0]!.hasMessage, true);
  assert.ok(s.trackers.includes("Google Analytics"));
  assert.ok(s.marketingStack.includes("HubSpot"));
  assert.deepEqual(s.emails, ["info@demo.test"]);
  assert.ok(s.socials.instagram);
  assert.ok(s.hasViewport);
});

test("extractSignals en web básica no inventa señales", () => {
  const s = sig(BASIC);
  assert.equal(s.whatsapp.detected, false);
  assert.equal(s.booking.detected, false);
  assert.equal(s.forms.length, 0);
  assert.deepEqual(s.trackers, []);
  assert.deepEqual(findContactLinks(BASIC, "https://demo.test/"), ["https://demo.test/contacto"]);
});

test("detector: web básica genera oportunidades con evidencia; web completa casi ninguna", () => {
  const poor = detectRules(company(), wrap(sig(BASIC)));
  const keys = poor.map((d) => d.problemKey);
  for (const k of ["no_whatsapp", "no_booking", "no_instant_response", "no_lead_capture", "no_tracking"]) assert.ok(keys.includes(k), k);
  assert.ok(poor.every((d) => d.evidence.length > 0 && d.solution && d.consequence));
  const rich = detectRules(company(), wrap(sig(RICH)));
  assert.deepEqual(rich.map((d) => d.problemKey), []);
});

test("detector: sin web y reputación débil", () => {
  const c = company({ website: null, rating: 3.6, review_count: 40 });
  const keys = detectRules(c, wrap(extractSignals([]), {}, c)).map((d) => d.problemKey);
  assert.ok(keys.includes("no_website") && keys.includes("weak_reputation"));
});

test("detector descarta oportunidades del LLM sin evidencia real", async () => {
  const s = wrap(sig(RICH), { llm: { used: true, error: null, extraOpportunities: [
    { title: "Inventado", problem: "p", evidenceKeys: ["website.noExiste"], consequence: "c", solution: "s", service: "x", impact: "i" },
    { title: "Real", problem: "p", evidenceKeys: ["website.forms"], consequence: "c", solution: "s", service: "x", impact: "i" },
  ] } });
  const out = await opportunityDetector.detect(company(), { summary: "", signals: s as any, snapshot: null, model: null, confidence: "high" });
  assert.deepEqual(out.map((d) => d.title), ["Real"]);
  assert.equal(out[0]!.confidence, "low");
});

test("SSRF: bloquea localhost y redes privadas", async () => {
  for (const u of ["http://localhost/", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.169.254/", "file:///etc/passwd"])
    await assert.rejects(assertPublicUrl(new URL(u)), FetchBlockedError, u);
});

test("extractJson tolera texto alrededor", () => assert.deepEqual(extractJson('Aquí: {"a":1} fin'), { a: 1 }));

const opp = (o: Partial<Opportunity>): Opportunity => ({ id: "o", company_id: "c1", analysis_id: null, problem_key: "no_whatsapp", title: "", problem: "", evidence: [], consequence: "", solution: "", service: "", impact: "",
  impact_level: "high", severity: 4, confidence: "medium", created_at: "", ...o });

test("scoring: desglose suma el total y está en 0..100", () => {
  const r = scoreCompany({ company: company(), opportunities: [opp({}), opp({ problem_key: "no_booking", severity: 5 }), opp({ problem_key: "no_tracking", severity: 2, impact_level: "low" })], hasAnalysis: true });
  assert.equal(r.breakdown.reduce((a, f) => a + f.points, 0), r.total);
  assert.ok(r.total > 0 && r.total <= 100);
  assert.equal(r.breakdown.reduce((a, f) => a + f.weight, 0), 100);
  assert.ok(r.breakdown.every((f) => f.points <= f.weight && f.explanation.length > 0));
});

test("scoring: sin análisis ni oportunidades la nota es baja y de confianza baja", () => {
  const r = scoreCompany({ company: company({ review_count: null }), opportunities: [], hasAnalysis: false });
  assert.equal(r.confidence, "low");
  assert.ok(r.total < 25);
});

test("scoring: más problemas graves puntúan más", () => {
  const few = scoreCompany({ company: company(), opportunities: [opp({ severity: 2, impact_level: "low" })], hasAnalysis: true });
  const many = scoreCompany({ company: company(), opportunities: [opp({ severity: 5 }), opp({ problem_key: "a", severity: 4 }), opp({ problem_key: "b", severity: 4 })], hasAnalysis: true });
  assert.ok(many.total > few.total);
});
