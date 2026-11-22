import Link from "next/link";
import { listCompanies, distinctValues, type CompanyFilters } from "@/lib/repo/companies";
import { CRM_STATUSES, CRM_LABELS, type CrmStatus } from "@/lib/types";
import { ScoreBadge, StatusBadge, host } from "@/components/ui";

export const dynamic = "force-dynamic";
type SP = Record<string, string | undefined>;
const num = (v?: string) => (v && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined);
const PAGE = 50;

export default async function Companies({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, num(sp.page) ?? 1);
  const filters: CompanyFilters = {
    q: sp.q || undefined, niche: sp.niche || undefined, location: sp.location || undefined,
    scoreMin: num(sp.scoreMin), scoreMax: num(sp.scoreMax), oppsMin: num(sp.oppsMin),
    problem: sp.problem || undefined, service: sp.service || undefined,
    status: (CRM_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as CrmStatus) : undefined,
    ratingMin: num(sp.ratingMin), reviewsMin: num(sp.reviewsMin),
    sort: (sp.sort as CompanyFilters["sort"]) || "score", dir: sp.dir === "asc" ? "asc" : "desc",
    limit: PAGE, offset: (page - 1) * PAGE,
  };
  const [{ rows, total }, opts] = await Promise.all([listCompanies(filters), distinctValues()]);

  const qs = (over: SP) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, v);
    return "?" + p.toString();
  };
  const sortLink = (key: string, label: string) => (
    <Link href={qs({ sort: key, dir: sp.sort === key && sp.dir !== "asc" ? "asc" : "desc", page: undefined })}>{label}{sp.sort === key || (!sp.sort && key === "score") ? (sp.dir === "asc" ? " ↑" : " ↓") : ""}</Link>
  );
  const hasFilter = Object.keys(sp).some((k) => !["sort", "dir", "page"].includes(k) && sp[k]);

  return (
    <>
      <div className="page-head"><div><h1>Empresas</h1><p className="sub">{total} {total === 1 ? "empresa" : "empresas"}{hasFilter ? " con los filtros aplicados" : ""}</p></div></div>
      <form className="panel filters" method="get">
        <div className="wide"><label className="lbl" htmlFor="q">Nombre, web o dirección</label><input id="q" name="q" className="input" defaultValue={sp.q} /></div>
        <div><label className="lbl" htmlFor="niche">Nicho</label><select id="niche" name="niche" className="input" defaultValue={sp.niche ?? ""}><option value="">Todos</option>{opts.niches.map((n) => <option key={n}>{n}</option>)}</select></div>
        <div><label className="lbl" htmlFor="location">Ubicación</label><input id="location" name="location" className="input" defaultValue={sp.location} /></div>
        <div><label className="lbl" htmlFor="status">Estado CRM</label><select id="status" name="status" className="input" defaultValue={sp.status ?? ""}><option value="">Todos</option>{CRM_STATUSES.map((s) => <option key={s} value={s}>{CRM_LABELS[s]}</option>)}</select></div>
        <div><label className="lbl" htmlFor="problem">Problema detectado</label><select id="problem" name="problem" className="input" defaultValue={sp.problem ?? ""}><option value="">Todos</option>{opts.problems.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}</select></div>
        <div><label className="lbl" htmlFor="service">Servicio recomendado</label><select id="service" name="service" className="input" defaultValue={sp.service ?? ""}><option value="">Todos</option>{opts.services.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="lbl" htmlFor="scoreMin">Puntaje mín.</label><input id="scoreMin" name="scoreMin" type="number" min={0} max={100} className="input" defaultValue={sp.scoreMin} /></div>
        <div><label className="lbl" htmlFor="oppsMin">Oportunidades mín.</label><input id="oppsMin" name="oppsMin" type="number" min={0} className="input" defaultValue={sp.oppsMin} /></div>
        <div><label className="lbl" htmlFor="ratingMin">Valoración mín.</label><input id="ratingMin" name="ratingMin" type="number" min={0} max={5} step={0.1} className="input" defaultValue={sp.ratingMin} /></div>
        <div><label className="lbl" htmlFor="reviewsMin">Reseñas mín.</label><input id="reviewsMin" name="reviewsMin" type="number" min={0} className="input" defaultValue={sp.reviewsMin} /></div>
        <div className="row"><button className="btn primary" type="submit">Filtrar</button>{hasFilter && <Link className="btn" href="/companies">Limpiar</Link>}</div>
      </form>

      <div className="tablewrap">
        <table className="t">
          <thead><tr>
            <th>{sortLink("name", "Empresa")}</th><th>Sitio web</th><th>Ubicación</th>
            <th className="num">{sortLink("score", "Puntaje")}</th><th className="num">Oport.</th>
            <th className="num">{sortLink("rating", "Valoración")}</th><th className="num">{sortLink("reviews", "Reseñas")}</th>
            <th>Estado</th><th>{sortLink("follow_up", "Seguimiento")}</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9}><div className="empty">{hasFilter ? "Ninguna empresa coincide con los filtros." : "Todavía no hay empresas. Lanza una búsqueda para descubrir negocios reales."}</div></td></tr>}
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link className="nm" href={`/companies/${c.id}`}>{c.name}</Link><div className="faint">{c.category ?? c.niche ?? ""}</div></td>
                <td className="muted">{host(c.website)}</td>
                <td className="muted">{c.city ?? c.address ?? "—"}</td>
                <td className="num"><ScoreBadge score={c.score} /></td>
                <td className="num">{c.analyzed_at ? c.opportunity_count : <span className="faint">—</span>}</td>
                <td className="num">{c.rating ?? <span className="faint">n/d</span>}</td>
                <td className="num">{c.review_count ?? <span className="faint">n/d</span>}</td>
                <td><StatusBadge status={c.crm_status} /></td>
                <td className="muted">{c.follow_up_date ? new Date(c.follow_up_date).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > PAGE && (
        <div className="row between" style={{ marginTop: 12 }}>
          <span className="muted">Página {page} de {Math.ceil(total / PAGE)}</span>
          <span className="row">
            {page > 1 && <Link className="btn sm" href={qs({ page: String(page - 1) })}>Anterior</Link>}
            {page * PAGE < total && <Link className="btn sm" href={qs({ page: String(page + 1) })}>Siguiente</Link>}
          </span>
        </div>
      )}
    </>
  );
}
