import { test } from "node:test";
import assert from "node:assert/strict";
import { createGooglePlacesProvider, mapPlace, FIELD_MASK } from "../lib/discovery/google-places";
import { createOsmProvider, nicheToTags, buildOverpassQuery } from "../lib/discovery/osm";
import { dedupeCompanies, normalizeWebsite, normalizePhone } from "../lib/discovery/normalize";
import { discoveryProviders } from "../lib/discovery/providers";

const place = (i: number, extra: object = {}) => ({
  id: `pid${i}`, displayName: { text: `Clínica ${i}` }, formattedAddress: `Calle ${i}, Madrid`,
  addressComponents: [{ longText: "Madrid", types: ["locality"] }, { longText: "Comunidad de Madrid", types: ["administrative_area_level_1"] }, { longText: "España", shortText: "ES", types: ["country"] }],
  location: { latitude: 40.4, longitude: -3.7 }, primaryTypeDisplayName: { text: "Dentista" }, websiteUri: `https://www.clinica${i}.es/?utm_source=x`,
  internationalPhoneNumber: `+34 600 000 ${String(i).padStart(3, "0")}`, rating: 4.5, userRatingCount: 10 + i, regularOpeningHours: { weekdayDescriptions: ["lunes: 9–18"] }, ...extra,
});
const json = (b: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(b), { status, headers });
const noWait = async () => {};

test("Google Places: pagina hasta 60, máscara de campos y deduplica", async () => {
  const calls: { body: any; headers: any }[] = [];
  const f = (async (_u: string, init: any) => {
    const body = JSON.parse(init.body); calls.push({ body, headers: init.headers });
    const page = calls.length;
    const places = Array.from({ length: 20 }, (_, k) => place((page - 1) * 20 + k + 1, k === 0 && page === 2 ? { id: "pid1" } : {}));
    return json({ places, nextPageToken: page < 5 ? `t${page}` : undefined });
  }) as typeof fetch;
  const p = createGooglePlacesProvider({ fetch: f, env: { GOOGLE_MAPS_API_KEY: "k" }, wait: noWait });
  const r = await p.discover({ niche: "clínicas dentales", location: "Madrid", limit: 100 });
  assert.equal(calls.length, 3);
  assert.equal(calls[0]!.body.textQuery, "clínicas dentales en Madrid");
  assert.equal(calls[1]!.body.pageToken, "t1");
  assert.equal(calls[0]!.headers["X-Goog-FieldMask"], FIELD_MASK);
  assert.ok(!FIELD_MASK.includes("reviews"));
  assert.equal(r.length, 59); // 60 menos 1 duplicado
  assert.equal(r[0]!.website, "https://www.clinica1.es");
  assert.equal((r[0]!.raw as any).source, "google_places");
  assert.ok((r[0]!.raw as any).fetchedAt);
});

test("Google Places: respeta limit y descarta cerrados", async () => {
  const f = (async () => json({ places: [place(1), place(2, { businessStatus: "CLOSED_PERMANENTLY" }), place(3)] })) as typeof fetch;
  const p = createGooglePlacesProvider({ fetch: f, env: { GOOGLE_MAPS_API_KEY: "k" }, wait: noWait });
  const r = await p.discover({ niche: "x", location: "y", limit: 5 });
  assert.deepEqual(r.map((c) => c.externalId), ["pid1", "pid3"]);
  assert.equal(r[0]!.reviewCount, 11);
  assert.equal(r[0]!.country, "ES");
});

test("Google Places: sin clave no está configurado; error 403 es claro y no filtra la clave", async () => {
  assert.equal(createGooglePlacesProvider({ env: {} }).isConfigured(), false);
  const f = (async () => json({ error: { message: "API not enabled" } }, 403)) as typeof fetch;
  const p = createGooglePlacesProvider({ fetch: f, env: { GOOGLE_MAPS_API_KEY: "SECRETKEY" }, wait: noWait });
  await assert.rejects(p.discover({ niche: "a", location: "b", limit: 5 }), (e: Error) => /403/.test(e.message) && !e.message.includes("SECRETKEY"));
});

test("Google Places: reintenta ante 429", async () => {
  let n = 0;
  const f = (async () => (++n === 1 ? json({}, 429) : json({ places: [place(1)] }))) as typeof fetch;
  const r = await createGooglePlacesProvider({ fetch: f, env: { GOOGLE_MAPS_API_KEY: "k" }, wait: noWait }).discover({ niche: "a", location: "b", limit: 5 });
  assert.equal(r.length, 1); assert.equal(n, 2);
});

test("mapPlace no inventa campos ausentes", () => {
  const c = mapPlace({ id: "x", displayName: { text: "Solo nombre" } }, "2026-01-01T00:00:00Z")!;
  assert.equal(c.rating, undefined); assert.equal(c.website, undefined); assert.equal(c.openingHours, undefined); assert.equal(c.phone, undefined);
});

test("OSM: geocodifica, consulta Overpass y deja rating/reseñas/horarios sin definir", async () => {
  const seen: string[] = [];
  const f = (async (u: string, init: any) => {
    seen.push(u); assert.equal(init.headers["User-Agent"], "Test/1.0 (a@b.c)");
    if (u.includes("nominatim")) return json([{ boundingbox: ["40.3", "40.6", "-3.8", "-3.5"], address: { city: "Madrid", state: "Comunidad de Madrid", country_code: "es" } }]);
    return json({ elements: [
      { type: "node", id: 1, lat: 40.4, lon: -3.7, tags: { name: "Dental Uno", amenity: "dentist", opening_hours: "Mo-Fr 09:00-18:00" } },
      { type: "way", id: 2, center: { lat: 40.41, lon: -3.71 }, tags: { name: "Dental Dos", amenity: "dentist", website: "dentaldos.es", phone: "+34 911 111 111", "contact:facebook": "facebook.com/dd" } },
      { type: "node", id: 3, tags: { amenity: "dentist" } },
    ] });
  }) as typeof fetch;
  const p = createOsmProvider({ fetch: f, env: { OSM_USER_AGENT: "Test/1.0 (a@b.c)" }, wait: noWait });
  const r = await p.discover({ niche: "clínicas dentales", location: "Madrid", limit: 10 });
  assert.equal(r.length, 2);
  assert.equal(r[0]!.name, "Dental Dos"); // prioriza los que tienen contacto
  assert.equal(r[0]!.website, "https://dentaldos.es");
  assert.equal(r[0]!.socials?.facebook, "https://facebook.com/dd");
  for (const c of r) { assert.equal(c.rating, undefined); assert.equal(c.reviewCount, undefined); assert.equal(c.openingHours, undefined); }
  assert.equal(r[0]!.externalId, "way/2");
  assert.equal(r[0]!.country, "ES");
  assert.match(decodeURIComponent(seen[1]!) + "", /overpass/);
});

test("OSM: sin OSM_USER_AGENT no está configurado; ubicación desconocida da error claro", async () => {
  assert.equal(createOsmProvider({ env: {} }).isConfigured(), false);
  const f = (async () => json([])) as typeof fetch;
  await assert.rejects(createOsmProvider({ fetch: f, env: { OSM_USER_AGENT: "t" }, wait: noWait }).discover({ niche: "dentistas", location: "Zzzz", limit: 5 }), /No se pudo ubicar/);
});

test("OSM: mapeo de nicho y consulta", () => {
  assert.ok(nicheToTags("Clínicas dentales").includes("amenity=dentist"));
  const q = buildOverpassQuery("tiendas de skate", [1, 2, 3, 4], 10);
  assert.equal(q.mode, "name");
  assert.match(buildOverpassQuery("restaurantes", [1, 2, 3, 4], 10).query, /amenity"="restaurant/);
});

test("normalización y deduplicación", () => {
  assert.equal(normalizeWebsite("WWW.Foo.com/?utm_x=1#a"), "https://WWW.Foo.com".replace("WWW.Foo", "www.foo"));
  assert.equal(normalizeWebsite("no es url"), undefined);
  assert.equal(normalizePhone("12"), undefined);
  const r = dedupeCompanies([
    { externalId: "a", name: "A", website: "https://a.com" },
    { externalId: "b", name: "A sl", website: "http://www.a.com/", phone: "+34 600 111 222" },
    { externalId: "c", name: "C", phone: "600111222" },
  ]);
  assert.equal(r.length, 2); // mismo teléfono con otro nombre NO se fusiona assert.equal(r[0]!.phone, "+34 600 111 222");
});

test("registro: Google primero, OSM de respaldo", () => {
  assert.deepEqual(discoveryProviders.map((p) => p.id), ["google_places", "osm"]);
});
