import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const USER_AGENT = "ProspectIntelligenceBot/0.1 (+analisis de presencia web; contacto via sitio del operador)";

export class FetchBlockedError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.") || l.startsWith("::ffff:192.168.");
  }
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Evita SSRF: solo http(s) y hosts que no resuelvan a redes privadas/loopback. */
export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchBlockedError(`Protocolo no permitido: ${url.protocol}`);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new FetchBlockedError("Host interno no permitido");
  let addrs: Array<{ address: string }>;
  try {
    addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  } catch (e) {
    // Detrás de un proxy de salida (HTTPS_PROXY) el DNS lo resuelve el proxy y el proxy ya filtra destinos internos.
    if (process.env.HTTPS_PROXY || process.env.https_proxy) return;
    throw e;
  }
  if (addrs.some((a) => isPrivateIp(a.address))) throw new FetchBlockedError("El host resuelve a una red privada");
}

export interface FetchedPage {
  url: string;        // URL final tras redirecciones
  status: number;
  html: string;
  loadMs: number;
  redirects: number;
  truncated: boolean;
}

export interface SafeFetchOptions { timeoutMs?: number; maxBytes?: number; maxRedirects?: number }

export function normalizeUrl(raw: string): URL {
  const t = raw.trim();
  return new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
}

/** GET con timeout, tope de tamaño y redirecciones validadas una a una. */
export async function safeFetchHtml(raw: string, opts: SafeFetchOptions = {}): Promise<FetchedPage> {
  const { timeoutMs = 15000, maxBytes = 1_500_000, maxRedirects = 5 } = opts;
  let url = normalizeUrl(raw);
  const started = Date.now();
  let redirects = 0;
  for (;;) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml", "accept-language": "es,en;q=0.8" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (++redirects > maxRedirects) throw new Error("Demasiadas redirecciones");
      url = new URL(res.headers.get("location")!, url);
      await res.body?.cancel();
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml|text/i.test(type)) { await res.body?.cancel(); return { url: url.href, status: res.status, html: "", loadMs: Date.now() - started, redirects, truncated: false }; }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = []; let size = 0; let truncated = false;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length; chunks.push(value);
      if (size >= maxBytes) { truncated = true; await reader.cancel(); break; }
    }
    const html = Buffer.concat(chunks).toString("utf8");
    return { url: url.href, status: res.status, html, loadMs: Date.now() - started, redirects, truncated };
  }
}
