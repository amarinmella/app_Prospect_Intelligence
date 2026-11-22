export type FetchLike = typeof fetch;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** fetch con timeout y reintentos con espera para 429/5xx. `wait` se puede inyectar en tests. */
export async function fetchRetry(
  f: FetchLike,
  url: string,
  init: RequestInit,
  opts: { retries?: number; timeoutMs?: number; baseDelayMs?: number; wait?: (ms: number) => Promise<void> } = {},
): Promise<Response> {
  const { retries = 2, timeoutMs = 30_000, baseDelayMs = 1500, wait = sleep } = opts;
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await f(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if ((res.status === 429 || res.status >= 500) && i < retries) {
        const ra = Number(res.headers.get("retry-after"));
        await wait(ra > 0 ? Math.min(ra * 1000, 30_000) : baseDelayMs * (i + 1));
        continue;
      }
      return res;
    } catch (e) {
      last = e;
      if (i < retries) await wait(baseDelayMs * (i + 1));
    }
  }
  throw new Error(`No se pudo conectar con ${new URL(url).host}: ${last instanceof Error ? last.message : String(last)}`);
}
