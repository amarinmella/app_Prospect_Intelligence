import Link from "next/link";
import { CRM_LABELS, CONFIDENCE_LABELS, type Confidence, type CrmStatus } from "@/lib/types";

export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="faint">—</span>;
  return <span className={`score ${score >= 70 ? "hi" : score >= 40 ? "mid" : "lo"}`}>{score}</span>;
}

const STATUS_TONE: Partial<Record<CrmStatus, string>> = { priority: "accent", won: "ok", lost: "bad", meeting: "accent", proposal: "accent", replied: "warn" };
export function StatusBadge({ status }: { status: CrmStatus }) {
  return <span className={`badge ${STATUS_TONE[status] ?? ""}`}>{CRM_LABELS[status]}</span>;
}
export function Conf({ c }: { c: Confidence | null }) {
  return c ? <span className="muted">{CONFIDENCE_LABELS[c]}</span> : <span className="faint">—</span>;
}

export function Notice({ kind, children }: { kind: "ok" | "warn" | "bad"; children: React.ReactNode }) {
  return <div className={`notice ${kind}`} role={kind === "ok" ? "status" : "alert"}>{children}</div>;
}

export function Bars({ rows, hrefFor }: { rows: { label: string; n: number; key?: string }[]; hrefFor?: (key: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <div className="empty">Sin datos todavía.</div>;
  return (
    <div>
      {rows.map((r) => (
        <div className="bar-row" key={r.key ?? r.label}>
          <span className="lab" title={r.label}>{hrefFor && r.key ? <Link href={hrefFor(r.key)}>{r.label}</Link> : r.label}</span>
          <span className="bar"><i style={{ width: `${(r.n / max) * 100}%` }} /></span>
          <span className="num">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export function fmtDate(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDateTime(d: string | Date): string {
  return new Date(d).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function host(url: string | null): string {
  if (!url) return "—";
  try { return new URL(url.startsWith("http") ? url : "https://" + url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export function isoDay(d: string | Date | null): string {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
