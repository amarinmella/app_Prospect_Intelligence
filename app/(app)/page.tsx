import Link from "next/link";
import { dashboardData } from "@/lib/repo/dashboard";
import { recentActivity } from "@/lib/repo/activity";
import { CRM_STATUSES, CRM_LABELS } from "@/lib/types";
import { Bars, fmtDateTime } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const d = await dashboardData();
  const activity = await recentActivity(12);
  const pipe = CRM_STATUSES.map((s) => ({ label: CRM_LABELS[s], key: s, n: d.pipeline.find((p) => p.status === s)?.n ?? 0 }));
  const maxBucket = Math.max(1, ...d.scoreBuckets.map((b) => b.n));
  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p className="sub">Estado del mercado analizado y del pipeline comercial.</p></div>
        <Link className="btn primary" href="/searches">Nueva búsqueda</Link>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="v">{d.found}</div><div className="l">Empresas encontradas</div></div>
        <div className="kpi"><div className="v">{d.analyzed}</div><div className="l">Analizadas</div></div>
        <div className="kpi"><div className="v">{d.priority}</div><div className="l">Prioritarias (puntaje ≥ 70)</div></div>
        <div className="kpi"><div className="v">{d.avgScore ?? "—"}</div><div className="l">Puntaje promedio</div></div>
        <div className="kpi"><div className="v">{d.followUpsDue}</div><div className="l">Seguimientos vencidos</div></div>
      </div>

      {d.found === 0 && (
        <div className="notice">Aún no hay empresas. Crea una <Link href="/searches" style={{ color: "var(--accent)" }}>búsqueda</Link> (requiere un proveedor de descubrimiento configurado, ver <Link href="/settings" style={{ color: "var(--accent)" }}>Configuración</Link>).</div>
      )}

      <div className="grid g-main">
        <div className="grid">
          <section className="panel">
            <h2>Distribución de puntajes</h2>
            {d.scoreBuckets.every((b) => b.n === 0) ? <div className="empty">Sin empresas puntuadas.</div> : (
              <div className="cols">{d.scoreBuckets.map((b) => (
                <div className="c" key={b.label}><b>{b.n}</b><i style={{ height: `${(b.n / maxBucket) * 80}px` }} />{b.label}</div>
              ))}</div>
            )}
            <p className="faint" style={{ marginTop: 8 }}>El puntaje es una heurística de priorización, no una medida científica.</p>
          </section>
          <div className="grid g2">
            <section className="panel">
              <h2>Problemas más habituales</h2>
              <Bars rows={d.topProblems.map((p) => ({ label: p.title, key: p.key, n: p.n }))} hrefFor={(k) => `/companies?problem=${encodeURIComponent(k)}`} />
            </section>
            <section className="panel">
              <h2>Servicios con mayor oportunidad</h2>
              <Bars rows={d.topServices.map((s) => ({ label: s.service, key: s.service, n: s.n }))} hrefFor={(k) => `/companies?service=${encodeURIComponent(k)}`} />
            </section>
          </div>
        </div>
        <div className="grid" style={{ alignContent: "start" }}>
          <section className="panel">
            <h2>Pipeline</h2>
            <Bars rows={pipe} hrefFor={(k) => `/companies?status=${k}`} />
          </section>
          <section className="panel">
            <h2>Actividad reciente</h2>
            {activity.length === 0 ? <div className="empty">Sin actividad.</div> : (
              <ul className="feed">{activity.map((a) => (
                <li key={a.id}><span>{a.company_id ? <Link className="nm" href={`/companies/${a.company_id}`}>{a.description}</Link> : a.description}</span><span className="faint" style={{ whiteSpace: "nowrap" }}>{fmtDateTime(a.created_at)}</span></li>
              ))}</ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
