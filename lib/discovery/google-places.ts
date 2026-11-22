import { compact, normalizePhone, normalizeWebsite, dedupeCompanies } from "./normalize";
import { fetchRetry, type FetchLike } from "./http";
import type { DiscoveredCompany, DiscoveryProvider, DiscoveryQuery } from "./types";

/**
 * Google Places API (New) · Text Search con paginación (máx. 60 resultados: 3 páginas de 20).
 * Field mask del SKU Enterprise (web, teléfono, rating, reseñas, horarios). NO pide `reviews` (SKU Atmosphere, más caro).
 * Términos de Google: solo place_id es almacenable sin límite; el resto se guarda como caché con fecha de obtención
 * (raw.fetchedAt) y debe refrescarse. Se persiste siempre externalId = place_id.
 */
export const GOOGLE_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
export const GOOGLE_MAX_RESULTS = 60;
const PAGE_SIZE = 20;

export const FIELD_MASK = [
  "places.id", "places.displayName", "places.formattedAddress", "places.addressComponents", "places.location",
  "places.primaryType", "places.primaryTypeDisplayName", "places.types", "places.businessStatus", "places.googleMapsUri",
  "places.websiteUri", "places.nationalPhoneNumber", "places.internationalPhoneNumber",
  "places.rating", "places.userRatingCount", "places.regularOpeningHours",
  "nextPageToken",
].join(",");

interface GPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  businessStatus?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: unknown[]; openNow?: boolean };
}

function component(p: GPlace, type: string): string | undefined {
  return p.addressComponents?.find((c) => c.types?.includes(type))?.longText;
}

export function mapPlace(p: GPlace, fetchedAt: string): DiscoveredCompany | null {
  const name = p.displayName?.text?.trim();
  if (!p.id || !name) return null;
  if (p.businessStatus === "CLOSED_PERMANENTLY") return null;
  const hours = p.regularOpeningHours;
  return compact<DiscoveredCompany>({
    externalId: p.id,
    name,
    category: p.primaryTypeDisplayName?.text ?? p.primaryType?.replace(/_/g, " "),
    website: normalizeWebsite(p.websiteUri),
    address: p.formattedAddress,
    city: component(p, "locality") ?? component(p, "postal_town") ?? component(p, "administrative_area_level_2"),
    region: component(p, "administrative_area_level_1"),
    country: p.addressComponents?.find((c) => c.types?.includes("country"))?.shortText,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    phone: normalizePhone(p.internationalPhoneNumber ?? p.nationalPhoneNumber),
    rating: typeof p.rating === "number" ? p.rating : undefined,
    reviewCount: typeof p.userRatingCount === "number" ? p.userRatingCount : undefined,
    openingHours: hours && (hours.weekdayDescriptions?.length || hours.periods?.length) ? { weekdayDescriptions: hours.weekdayDescriptions, periods: hours.periods } : undefined,
    sourceUrl: p.googleMapsUri,
    raw: { source: "google_places", fetchedAt, cacheNote: "Campos de Google: caché con fecha de obtención; refrescar antes de reutilizar.", place: p },
  });
}

export function createGooglePlacesProvider(deps: { fetch?: FetchLike; env?: Record<string, string | undefined>; wait?: (ms: number) => Promise<void>; now?: () => Date } = {}): DiscoveryProvider {
  const env = () => deps.env ?? process.env;
  return {
    id: "google_places",
    label: "Google Places",
    requiredEnv: ["GOOGLE_MAPS_API_KEY"],
    isConfigured: () => Boolean(env().GOOGLE_MAPS_API_KEY?.trim()),
    async discover(q: DiscoveryQuery): Promise<DiscoveredCompany[]> {
      const key = env().GOOGLE_MAPS_API_KEY?.trim();
      if (!key) throw new Error("Falta GOOGLE_MAPS_API_KEY");
      const f = deps.fetch ?? fetch;
      const target = Math.max(1, Math.min(Math.floor(q.limit) || 1, GOOGLE_MAX_RESULTS));
      const textQuery = `${q.niche} en ${q.location}`.trim();
      const fetchedAt = (deps.now?.() ?? new Date()).toISOString();
      let all: DiscoveredCompany[] = [];
      let pageToken: string | undefined;
      let requests = 0;

      while (requests < GOOGLE_MAX_RESULTS / PAGE_SIZE) {
        const body: Record<string, unknown> = { textQuery, pageSize: PAGE_SIZE };
        if (pageToken) body.pageToken = pageToken;
        const res = await fetchRetry(f, GOOGLE_PLACES_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
          body: JSON.stringify(body),
        }, { wait: deps.wait });
        requests++;
        if (!res.ok) {
          let detail = "";
          try { detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ""; } catch { /* sin cuerpo */ }
          const hint = res.status === 400 || res.status === 403
            ? " Revisa que 'Places API (New)' esté habilitada, la facturación activa y la clave sin restricciones que la bloqueen."
            : "";
          throw new Error(`Google Places respondió ${res.status}: ${detail || res.statusText}.${hint}`);
        }
        const json = (await res.json()) as { places?: GPlace[]; nextPageToken?: string };
        for (const p of json.places ?? []) {
          const c = mapPlace(p, fetchedAt);
          if (c) all.push(c);
        }
        all = dedupeCompanies(all);
        pageToken = json.nextPageToken;
        if (!pageToken || all.length >= target) break;
      }
      return all.slice(0, target);
    },
  };
}

export const googlePlaces = createGooglePlacesProvider();
