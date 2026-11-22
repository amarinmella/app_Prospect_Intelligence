// Pruebas contra sitios reales. Se ejecutan solo con LIVE=1 (requieren red): LIVE=1 npx tsx --test tests/live.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { websiteAnalyzer } from "../lib/analysis/analyzer";
import { opportunityDetector } from "../lib/analysis/detector";

const SITES = (process.env.LIVE_SITES ?? "https://www.clinicaalemana.cl,https://www.dentalcenter.es,https://www.innovaiastudio.com").split(",");
const live = process.env.LIVE === "1";

for (const url of SITES) {
  test(`live: ${url}`, { skip: !live }, async () => {
    const company: any = { id: "x", name: url, niche: "clínica", category: null, website: url, socials: {}, rating: 4.2, review_count: 80, phone: null, email: null };
    const a = await websiteAnalyzer.analyze(company);
    const opps = await opportunityDetector.detect(company, a);
    const w = (a.signals as any).website;
    console.log(url, { reachable: w.reachable, error: w.error, status: w.status, loadMs: w.loadMs, title: w.title, whatsapp: w.whatsapp.detected, booking: w.booking, chat: w.chat, forms: w.forms.length, trackers: w.trackers, opps: opps.map((o) => o.problemKey), llm: (a.signals as any).llm.error });
    assert.ok(a.summary.length > 0);
    assert.ok(opps.every((o) => o.evidence.length > 0));
  });
}
