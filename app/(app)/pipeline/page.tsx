import Link from "next/link";
import { listCompanies } from "@/lib/repo/companies";
import { CRM_STATUSES, CRM_LABELS } from "@/lib/types";
import { ScoreBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Pipeline() {
  const { rows } = await listCompanies({ limit: 200, sort: "score" });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (
    <>
      <div className="page-head"><div><h1>CRM</h1><p className="sub">Pipeline por estado. Abre una empresa para cambiar estado, responsable, próxima acción y seguimiento.</p></div></div>
      {rows.length === 0 && <div className="notice">El pipeline está vacío: aparecerán aquí las empresas descubiertas.</div>}
      <div className="kanban">
        {CRM_STATUSES.map((s) => {
          const items = rows.filter((r) => r.crm_status === s);
          return (
            <section className="col" key={s} aria-label={CRM_LABELS[s]}>
              <h2><span>{CRM_LABELS[s]}</span><span>{items.length}</span></h2>
              {items.map((c) => {
                const overdue = c.follow_up_date && new Date(c.follow_up_date) <= today && s !== "won" && s !== "lost";
                return (
                  <Link className="card" href={`/companies/${c.id}`} key={c.id}>
                    <div className="row between"><span className="nm">{c.name}</span><ScoreBadge score={c.score} /></div>
                    {c.next_action && <div className="muted">{c.next_action}</div>}
                    <div className="faint">{c.owner ?? "Sin responsable"}{c.follow_up_date ? ` · ${new Date(c.follow_up_date).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}` : ""}{overdue ? " · vencido" : ""}</div>
                  </Link>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}
