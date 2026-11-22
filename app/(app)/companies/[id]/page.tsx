import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/repo/companies";
import { latestAnalysis, listOpportunities, latestScore, listMessages, listReports, listNotes } from "@/lib/repo/analysis";
import { companyActivity } from "@/lib/repo/activity";
import { actAnalyze, actMessage, actReport, saveCrm, saveNote, removeCompany } from "@/app/actions";
import { CRM_STATUSES, CRM_LABELS, CHANNEL_LABELS, CONFIDENCE_LABELS, type MessageChannel } from "@/lib/types";
import { Conf, Notice, ScoreBadge, StatusBadge, fmtDate, fmtDateTime, host, isoDay } from "@/components/ui";

export const dynamic = "force-dynamic";
type SP = { ok?: string; warn?: string };

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const c = await getCompany(id);
  if (!c) notFound();
  const [analysis, opps, score, messages, reports, notes, activity] = await Promise.all([
    latestAnalysis(id), listOpportunities(id), latestScore(id), listMessages(id), listReports(id), listNotes(id), companyActivity(id, 15),
  ]);
  const socials = Object.entries(c.socials ?? {}).filter(([, v]) => v);
  const nd = <span className="faint">no disponible</span>;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="sub"><Link href="/companies">← Empresas</Link></p>
          <h1>{c.name} <ScoreBadge score={c.score} /></h1>
          <p className="sub">{c.category ?? c.niche ?? "Sin categoría"} · {c.address ?? c.city ?? "Sin dirección"}</p>
        </div>
        <div className="row">
          <form action={actAnalyze}><input type="hidden" name="id" value={c.id} /><button className="btn primary">{c.analyzed_at ? "Re-analizar" : "Analizar"}</button></form>
          <form action={actReport}><input type="hidden" name="id" value={c.id} /><button className="btn">Generar informe</button></form>
        </div>
      </div>

      {sp.ok && <Notice kind="ok">{sp.ok}</Notice>}
      {sp.warn && <Notice kind="warn">{sp.warn}</Notice>}

      <div className="grid g-main">
        <div className="stack">
          <section className="panel">
            <h2>Información general</h2>
            <dl className="dl">
              <dt>Sitio web</dt><dd>{c.website ? <a className="nm" href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer">{host(c.website)}</a> : nd}</dd>
              <dt>Teléfono</dt><dd>{c.phone ?? nd}</dd>
              <dt>Email</dt><dd>{c.email ?? nd}</dd>
              <dt>Valoración</dt><dd>{c.rating != null ? `${c.rating} / 5 · ${c.review_count ?? 0} reseñas` : nd}</dd>
              <dt>Redes</dt><dd>{socials.length ? socials.map(([k, v]) => <a key={k} className="badge" style={{ marginRight: 6 }} href={v} target="_blank" rel="noopener noreferrer">{k}</a>) : nd}</dd>
              <dt>Horarios</dt><dd>{c.opening_hours ? <span className="mono">{JSON.stringify(c.opening_hours)}</span> : nd}</dd>
              <dt>Tamaño / actividad</dt><dd>{c.size_hint ?? nd}</dd>
              <dt>Descripción</dt><dd>{c.description ?? nd}</dd>
              <dt>Agregada</dt><dd>{fmtDate(c.created_at)}</dd>
            </dl>
          </section>

          <section className="panel">
            <h2>Resumen del análisis</h2>
            {analysis ? (
              <>
                <p>{analysis.summary}</p>
                <p className="faint">Confianza {CONFIDENCE_LABELS[analysis.confidence].toLowerCase()} · {fmtDateTime(analysis.created_at)}{analysis.model ? ` · ${analysis.model}` : ""}</p>
              </>
            ) : <div className="empty">Esta empresa aún no ha sido analizada.</div>}
          </section>

          <section>
            <h2>Oportunidades ({opps.length})</h2>
            {opps.length === 0 && <div className="panel empty">{analysis ? "El análisis no encontró oportunidades con evidencia suficiente." : "Se detectan al analizar la empresa."}</div>}
            {opps.map((o) => (
              <article className="opp" key={o.id}>
                <div className="row between"><h3>{o.title}</h3><span className="row"><span className="badge">{o.service}</span><span className={`badge ${o.severity >= 4 ? "bad" : o.severity === 3 ? "warn" : ""}`}>Severidad {o.severity}/5</span></span></div>
                <dl>
                  <dt>Problema</dt><dd>{o.problem}</dd>
                  <dt>Evidencia</dt><dd>{o.evidence.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{o.evidence.map((e, i) => <li key={i}>{e.text} <span className="faint">({e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.source}</a> : e.source})</span></li>)}</ul> : nd}</dd>
                  <dt>Consecuencia</dt><dd>{o.consequence}</dd>
                  <dt>Solución</dt><dd>{o.solution}</dd>
                  <dt>Impacto</dt><dd>{o.impact} <span className="faint">(estimado, {CONFIDENCE_LABELS[o.impact_level].toLowerCase()})</span></dd>
                  <dt>Confianza</dt><dd><Conf c={o.confidence} /></dd>
                </dl>
              </article>
            ))}
          </section>

          <section className="panel">
            <h2>Por qué este puntaje</h2>
            {score ? (
              <>
                <table className="t"><thead><tr><th>Factor</th><th className="num">Puntos</th><th>Explicación</th></tr></thead>
                  <tbody>{score.breakdown.map((f, i) => <tr key={i}><td>{f.factor}</td><td className="num">{f.points} / {f.weight}</td><td className="muted">{f.explanation}</td></tr>)}
                    <tr><td><b>Total</b></td><td className="num"><b>{score.total}</b></td><td className="muted">Confianza {CONFIDENCE_LABELS[score.confidence].toLowerCase()}</td></tr></tbody></table>
                <p className="faint" style={{ marginTop: 8 }}>Heurística de priorización ({score.method}); no es una medida científica.</p>
              </>
            ) : <div className="empty">Sin puntaje todavía.</div>}
          </section>

          <section className="panel">
            <h2>Mensajes de contacto</h2>
            <div className="row" style={{ marginBottom: 10 }}>
              {(Object.keys(CHANNEL_LABELS) as MessageChannel[]).map((ch) => (
                <form action={actMessage} key={ch}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="channel" value={ch} /><button className="btn sm">Generar {CHANNEL_LABELS[ch]}</button></form>
              ))}
            </div>
            {messages.length === 0 ? <div className="empty">Sin mensajes generados.</div> : messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 12 }}>
                <div className="row between"><span className="badge accent">{CHANNEL_LABELS[m.channel]}</span><span className="faint">{fmtDateTime(m.created_at)}</span></div>
                {m.subject && <p style={{ marginTop: 6 }}><b>Asunto:</b> {m.subject}</p>}
                <div className="pre" style={{ marginTop: 6 }}>{m.body}</div>
              </div>
            ))}
          </section>

          <section className="panel">
            <h2>Informes</h2>
            {reports.length === 0 ? <div className="empty">Sin informes generados.</div> : (
              <ul className="feed">{reports.map((r) => <li key={r.id}><span>{r.title}</span><span className="row"><span className="faint">{fmtDateTime(r.created_at)}</span><a className="btn sm" href={`/api/reports/${r.id}/pdf`}>Descargar PDF</a></span></li>)}</ul>
            )}
          </section>
        </div>

        <div className="stack" style={{ alignContent: "start" }}>
          <section className="panel">
            <h2>CRM</h2>
            <p><StatusBadge status={c.crm_status} /></p>
            <form action={saveCrm} className="stack">
              <input type="hidden" name="id" value={c.id} />
              <div><label className="lbl" htmlFor="status">Estado</label><select id="status" name="status" className="input" defaultValue={c.crm_status}>{CRM_STATUSES.map((s) => <option key={s} value={s}>{CRM_LABELS[s]}</option>)}</select></div>
              <div><label className="lbl" htmlFor="owner">Responsable</label><input id="owner" name="owner" className="input" defaultValue={c.owner ?? ""} /></div>
              <div><label className="lbl" htmlFor="next_action">Próxima acción</label><input id="next_action" name="next_action" className="input" defaultValue={c.next_action ?? ""} /></div>
              <div><label className="lbl" htmlFor="follow_up_date">Fecha de seguimiento</label><input id="follow_up_date" name="follow_up_date" type="date" className="input" defaultValue={isoDay(c.follow_up_date)} /></div>
              <button className="btn primary" type="submit">Guardar</button>
            </form>
          </section>

          <section className="panel">
            <h2>Notas</h2>
            <form action={saveNote} className="stack">
              <input type="hidden" name="id" value={c.id} />
              <textarea name="body" className="input" required placeholder="Contexto, llamadas, acuerdos…" aria-label="Nueva nota" />
              <button className="btn" type="submit">Añadir nota</button>
            </form>
            <ul className="feed" style={{ marginTop: 10 }}>{notes.map((n) => <li key={n.id} style={{ display: "block" }}><div className="faint">{fmtDateTime(n.created_at)}</div>{n.body}</li>)}</ul>
          </section>

          <section className="panel">
            <h2>Actividad</h2>
            {activity.length === 0 ? <div className="empty">Sin actividad.</div> : <ul className="feed">{activity.map((a) => <li key={a.id}><span>{a.description}</span><span className="faint" style={{ whiteSpace: "nowrap" }}>{fmtDateTime(a.created_at)}</span></li>)}</ul>}
          </section>

          <form action={removeCompany}><input type="hidden" name="id" value={c.id} /><button className="btn danger sm" type="submit">Eliminar empresa</button></form>
        </div>
      </div>
    </>
  );
}
