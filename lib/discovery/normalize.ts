import type { DiscoveredCompany } from "./types";

/** Normaliza una URL de sitio web: https por defecto, sin hash ni parámetros de tracking. Devuelve undefined si no es válida. */
export function normalizeWebsite(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let s = raw.trim();
  if (!s) return undefined;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    if (!u.hostname.includes(".")) return undefined;
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.host}${path}${u.search}`;
  } catch {
    return undefined;
  }
}

/** Dominio comparable (sin www.) para deduplicar. */
export function websiteDomain(raw?: string | null): string | undefined {
  const n = normalizeWebsite(raw);
  if (!n) return undefined;
  return new URL(n).hostname.toLowerCase().replace(/^www\./, "");
}

/** Teléfono: conserva el formato de la fuente, solo recorta espacios. Devuelve undefined si no tiene dígitos suficientes. */
export function normalizePhone(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const s = raw.split(/[;,]/)[0]!.replace(/\s+/g, " ").trim();
  return s.replace(/\D/g, "").length >= 6 ? s : undefined;
}

export function phoneDigits(raw?: string | null): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function normalizeEmail(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const s = raw.split(/[;,]/)[0]!.trim().replace(/^mailto:/i, "").toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : undefined;
}

export function normalizeName(raw: string): string {
  return raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Quita campos undefined/vacíos para no persistir basura. */
export function compact<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) {
    const v = o[k];
    if (v === undefined || v === null || v === "") delete o[k];
  }
  return o;
}

/** Elimina duplicados: mismo externalId, mismo dominio web, mismo teléfono+nombre o mismo nombre+dirección. Conserva el primero y completa huecos con los siguientes. */
export function dedupeCompanies(list: DiscoveredCompany[]): DiscoveredCompany[] {
  const out: DiscoveredCompany[] = [];
  const byKey = new Map<string, DiscoveredCompany>();
  const keysOf = (c: DiscoveredCompany): string[] => {
    const keys = [`id:${c.externalId}`];
    const d = websiteDomain(c.website);
    if (d) keys.push(`web:${d}`);
    const p = phoneDigits(c.phone);
    // Teléfono solo junto al nombre: centralitas y cadenas comparten número entre negocios distintos.
    if (p.length >= 7) keys.push(`tel:${p.slice(-9)}|${normalizeName(c.name)}`);
    if (c.address) keys.push(`na:${normalizeName(c.name)}|${normalizeName(c.address)}`);
    return keys;
  };
  for (const c of list) {
    const keys = keysOf(c);
    const hit = keys.map((k) => byKey.get(k)).find(Boolean);
    if (hit) {
      for (const k of Object.keys(c) as (keyof DiscoveredCompany)[]) {
        if (k === "raw" || k === "externalId") continue;
        if (hit[k] === undefined || hit[k] === "") (hit as unknown as Record<string, unknown>)[k] = c[k];
      }
      for (const k of keys) if (!byKey.has(k)) byKey.set(k, hit);
      continue;
    }
    out.push(c);
    for (const k of keys) byKey.set(k, c);
  }
  return out;
}
