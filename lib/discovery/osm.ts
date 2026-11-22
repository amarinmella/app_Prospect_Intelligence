import { compact, dedupeCompanies, normalizeEmail, normalizePhone, normalizeWebsite } from "./normalize";
import { fetchRetry, sleep, type FetchLike } from "./http";
import type { DiscoveredCompany, DiscoveryProvider, DiscoveryQuery } from "./types";

/**
 * Respaldo sin clave: Nominatim (geocodifica la ubicación) + Overpass (negocios en esa zona).
 * Rating, número de reseñas y horarios NO existen en OSM: se dejan sin definir (la UI los muestra "no disponible").
 * Datos ODbL: atribución "© OpenStreetMap contributors" (se incluye en raw.attribution y sourceUrl).
 * Políticas: User-Agent propio (OSM_USER_AGENT), Nominatim 1 req/s, sin paralelismo, pausa ante 429.
 */
export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/** Términos de nicho (sin tildes, minúsculas) -> filtros de etiquetas OSM. */
const NICHE_TAGS: { re: RegExp; tags: string[] }[] = [
  { re: /dental|dentist|odontolog/, tags: ["amenity=dentist", "healthcare=dentist"] },
  { re: /veterinari|\bvet\b/, tags: ["amenity=veterinary"] },
  { re: /farmacia|pharmac/, tags: ["amenity=pharmacy"] },
  { re: /clinica|medic|doctor|salud/, tags: ["amenity=clinic", "amenity=doctors", "healthcare=clinic"] },
  { re: /fisioterap|kinesi|physio/, tags: ["healthcare=physiotherapist"] },
  { re: /optic/, tags: ["shop=optician"] },
  { re: /psicolog|psycholog|terapeut/, tags: ["healthcare=psychotherapist"] },
  { re: /restaurant|restaurante/, tags: ["amenity=restaurant"] },
  { re: /cafeteria|cafe\b|coffee/, tags: ["amenity=cafe"] },
  { re: /\bbar(es)?\b/, tags: ["amenity=bar", "amenity=pub"] },
  { re: /hotel|alojamiento/, tags: ["tourism=hotel", "tourism=hostel", "tourism=guest_house"] },
  { re: /gimnasio|gym|fitness/, tags: ["leisure=fitness_centre"] },
  { re: /peluquer|barber|hair/, tags: ["shop=hairdresser"] },
  { re: /estetica|belleza|beauty|spa\b/, tags: ["shop=beauty", "leisure=spa"] },
  { re: /abogad|lawyer|juridic/, tags: ["office=lawyer"] },
  { re: /contab|accountant|asesor/, tags: ["office=accountant", "office=tax_advisor"] },
  { re: /inmobiliari|real estate/, tags: ["office=estate_agent"] },
  { re: /seguro|insurance/, tags: ["office=insurance"] },
  { re: /academia|colegio|escuela|school|idioma/, tags: ["amenity=school", "amenity=language_school", "amenity=college"] },
  { re: /taller|mecanic|garage|car repair/, tags: ["shop=car_repair"] },
  { re: /panader|bakery/, tags: ["shop=bakery"] },
  { re: /ferreteri|hardware/, tags: ["shop=hardware"] },
  { re: /arquitect/, tags: ["office=architect"] },
  { re: /fotograf/, tags: ["shop=photo", "craft=photographer"] },
];

export function nicheToTags(niche: string): string[] {
  const n = niche.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const out = new Set<string>();
  for (const m of NICHE_TAGS) if (m.re.test(n)) m.tags.forEach((t) => out.add(t));
  return [...out];
}

const esc = (s: string) => s.replace(/[\\"]/g, "\\$&").replace(/[.*+?^${}()|[\]]/g, "\\$&");

export function buildOverpassQuery(niche: string, bbox: [number, number, number, number], limit: number): { query: string; mode: "tags" | "name" } {
  const [s, w, n, e] = bbox;
  const area = `(${s},${w},${n},${e})`;
  const tags = nicheToTags(niche);
  let body: string;
  let mode: "tags" | "name";
  if (tags.length) {
    mode = "tags";
    body = tags.map((t) => { const [k, v] = t.split("="); return `nwr["${k}"="${v}"]["name"]${area};`; }).join("");
  } else {
    // Sin mapeo conocido: búsqueda por palabras del nicho en el nombre. Cobertura menor; se marca en raw.
    mode = "name";
    const words = niche.split(/\s+/).filter((w) => w.length > 3).slice(0, 3).map(esc);
    if (!words.length) throw new Error(`No se puede buscar "${niche}" en OpenStreetMap sin una categoría reconocible.`);
    body = `nwr["name"~"${words.join("|")}",i]${area};`;
  }
  // Se piden más de las necesarias porque luego se prioriza las que tienen contacto.
  return { query: `[out:json][timeout:25];(${body});out center tags ${Math.min(limit * 4, 400)};`, mode };
}

interface OsmEl { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

export function mapElement(el: OsmEl, niche: string, geo: { city?: string; region?: string; country?: string }, fetchedAt: string, mode: string): DiscoveredCompany | null {
  const t = el.tags ?? {};
  const name = t.name?.trim();
  if (!name) return null;
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
  const address = [street, t["addr:postcode"], t["addr:city"]].filter(Boolean).join(", ") || undefined;
  const social = (k: string) => t[`contact:${k}`] ?? t[k];
  const socials = compact({
    facebook: normalizeWebsite(social("facebook")), instagram: normalizeWebsite(social("instagram")),
    linkedin: normalizeWebsite(social("linkedin")), tiktok: normalizeWebsite(social("tiktok")),
    youtube: normalizeWebsite(social("youtube")), x: normalizeWebsite(social("twitter")),
  } as Record<string, string | undefined>);
  const type = t.amenity ?? t.shop ?? t.office ?? t.healthcare ?? t.tourism ?? t.leisure ?? t.craft;
  return compact<DiscoveredCompany>({
    externalId: `${el.type}/${el.id}`,
    name,
    category: type ? type.replace(/_/g, " ") : niche,
    website: normalizeWebsite(t.website ?? t["contact:website"]),
    address,
    city: t["addr:city"] ?? geo.city,
    region: geo.region,
    country: geo.country,
    lat: el.lat ?? el.center?.lat,
    lng: el.lon ?? el.center?.lon,
    phone: normalizePhone(t.phone ?? t["contact:phone"] ?? t["contact:mobile"]),
    email: normalizeEmail(t.email ?? t["contact:email"]),
    socials: Object.keys(socials).length ? socials : undefined,
    // rating, reviewCount y openingHours: no disponibles en OSM (intencionalmente sin definir)
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    raw: { source: "osm", fetchedAt, attribution: "© OpenStreetMap contributors (ODbL)", matchMode: mode, element: el },
  });
}

const contactScore = (c: DiscoveredCompany) => (c.website ? 2 : 0) + (c.phone ? 1 : 0) + (c.email ? 1 : 0) + (c.address ? 1 : 0);

export function createOsmProvider(deps: { fetch?: FetchLike; env?: Record<string, string | undefined>; wait?: (ms: number) => Promise<void>; now?: () => Date } = {}): DiscoveryProvider {
  const env = () => deps.env ?? process.env;
  return {
    id: "osm",
    label: "OpenStreetMap (sin clave: sin valoraciones, reseñas ni horarios)",
    requiredEnv: ["OSM_USER_AGENT"],
    isConfigured: () => Boolean(env().OSM_USER_AGENT?.trim()),
    async discover(q: DiscoveryQuery): Promise<DiscoveredCompany[]> {
      const ua = env().OSM_USER_AGENT?.trim();
      if (!ua) throw new Error("Falta OSM_USER_AGENT");
      const f = deps.fetch ?? fetch;
      const wait = deps.wait ?? sleep;
      const headers = { "User-Agent": ua, Accept: "application/json" };
      const fetchedAt = (deps.now?.() ?? new Date()).toISOString();
      const limit = Math.max(1, Math.floor(q.limit) || 1);

      // 1) Geocodificar la ubicación (1 solicitud, respetando la política de Nominatim)
      const geoUrl = `${NOMINATIM_URL}?${new URLSearchParams({ q: q.location, format: "jsonv2", limit: "1", addressdetails: "1" })}`;
      const geoRes = await fetchRetry(f, geoUrl, { headers }, { wait: deps.wait });
      if (!geoRes.ok) throw new Error(`Nominatim respondió ${geoRes.status}`);
      const geo = (await geoRes.json()) as { boundingbox?: string[]; address?: Record<string, string> }[];
      const hit = geo[0];
      if (!hit?.boundingbox || hit.boundingbox.length < 4) throw new Error(`No se pudo ubicar "${q.location}" en OpenStreetMap.`);
      const [s, n, w, e] = hit.boundingbox.map(Number) as [number, number, number, number];
      if ([s, n, w, e].some((x) => !Number.isFinite(x))) throw new Error(`Ubicación inválida para "${q.location}".`);
      const a = hit.address ?? {};
      const place = { city: a.city ?? a.town ?? a.village ?? a.municipality, region: a.state ?? a.region, country: a.country_code?.toUpperCase() };
      await wait(1100);

      // 2) Overpass
      const { query, mode } = buildOverpassQuery(q.niche, [s, w, n, e], limit);
      const base = env().OVERPASS_URL?.trim() || DEFAULT_OVERPASS_URL;
      const res = await fetchRetry(f, base, {
        method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(query)}`,
      }, { wait: deps.wait, timeoutMs: 45_000, baseDelayMs: 30_000 });
      if (!res.ok) throw new Error(`Overpass respondió ${res.status}. El servidor público puede estar saturado; reintenta en unos minutos.`);
      const json = (await res.json()) as { elements?: OsmEl[] };
      const mapped = (json.elements ?? []).map((el) => mapElement(el, q.niche, place, fetchedAt, mode)).filter((c): c is DiscoveredCompany => c !== null);
      return dedupeCompanies(mapped.sort((x, y) => contactScore(y) - contactScore(x))).slice(0, limit);
    },
  };
}

export const osm = createOsmProvider();
