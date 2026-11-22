export interface PageSpeedResult {
  strategy: "mobile";
  performance: number | null;    // 0..100
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  fcpMs: number | null;
  fetchedAt: string;
}

/** PageSpeed Insights (móvil). PAGESPEED_API_KEY es opcional: sin clave aplica la cuota anónima, más baja. */
export async function fetchPageSpeed(url: string, apiKey = process.env.PAGESPEED_API_KEY): Promise<PageSpeedResult | null> {
  const q = new URLSearchParams({ url, strategy: "mobile", category: "performance" });
  if (apiKey) q.set("key", apiKey);
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return null;
    const j = (await res.json()) as any;
    const a = j?.lighthouseResult?.audits ?? {};
    const score = j?.lighthouseResult?.categories?.performance?.score;
    return {
      strategy: "mobile",
      performance: typeof score === "number" ? Math.round(score * 100) : null,
      lcpMs: a["largest-contentful-paint"]?.numericValue ?? null,
      cls: a["cumulative-layout-shift"]?.numericValue ?? null,
      tbtMs: a["total-blocking-time"]?.numericValue ?? null,
      fcpMs: a["first-contentful-paint"]?.numericValue ?? null,
      fetchedAt: new Date().toISOString(),
    };
  } catch { return null; }
}
