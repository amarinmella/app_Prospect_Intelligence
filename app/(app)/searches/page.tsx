import { listSearches } from "@/lib/repo/searches";
import { newSearch, rerunSearch } from "@/app/actions";
import { listDiscoveryProviders, activeDiscoveryProvider } from "@/lib/discovery";
import { Notice, fmtDateTime } from "@/components/ui";

export const dynamic = "force-dynamic";
const STATUS: Record<string, [string, string]> = { pending: ["Pendiente", ""], running: ["En curso", "accent"], completed: ["Completada", "ok"], failed: ["Falló / bloqueada", "bad"] };

export default async function Searches({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const searches = await listSearches();
  const provider = activeDiscoveryProvider();
  const env = listDiscoveryProviders().flatMap((p) => p.requiredEnv);
  return (
    <>
      <div className="page-head"><div><h1>Búsquedas</h1><p className="sub">Introduce un nicho y una ubicación para descubrir negocios reales.</p></div></div>
      {error && <Notice kind="bad">{error}</Notice>}
      {!provider && <Notice kind="warn">No hay proveedor de descubrimiento configurado{env.length ? <>: define {env.map((e) => <code key={e} className="mono"> {e}</code>)}</> : " todavía"}. Puedes crear la búsqueda; quedará marcada como bloqueada y se puede relanzar luego.</Notice>}
      <form action={newSearch} className="panel filters" style={{ gridTemplateColumns: "2fr 2fr 1fr auto" }}>
        <div><label className="lbl" htmlFor="niche">Tipo de negocio</label><input id="niche" name="niche" className="input" required placeholder="clínicas dentales" /></div>
        <div><label className="lbl" htmlFor="location">Ciudad o ubicación</label><input id="location" name="location" className="input" required placeholder="Santiago, Chile" /></div>
        <div><label className="lbl" htmlFor="count">Nº de empresas</label><input id="count" name="count" type="number" min={1} max={500} defaultValue={20} className="input" /></div>
        <button className="btn primary" type="submit">Buscar</button>
      </form>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>Búsqueda</th><th>Estado</th><th className="num">Nuevas</th><th>Fuente</th><th>Creada</th><th></th></tr></thead>
          <tbody>
            {searches.length === 0 && <tr><td colSpan={6}><div className="empty">Aún no hay búsquedas.</div></td></tr>}
            {searches.map((s) => (
              <tr key={s.id}>
                <td><span className="nm">{s.niche}</span> <span className="muted">en {s.location}</span><div className="faint">Objetivo: {s.target_count}</div>{s.error && <div className="err">{s.error}</div>}</td>
                <td><span className={`badge ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span></td>
                <td className="num">{s.found_count}</td>
                <td className="muted">{s.provider ?? "—"}</td>
                <td className="muted">{fmtDateTime(s.created_at)}</td>
                <td>{(s.status === "failed" || s.status === "pending") && <form action={rerunSearch}><input type="hidden" name="id" value={s.id} /><button className="btn sm">Relanzar</button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
