import { dbMode } from "@/lib/db/client";
import { listDiscoveryProviders } from "@/lib/discovery";

export const dynamic = "force-dynamic";

const VARS: { name: string; use: string; required?: boolean }[] = [
  { name: "DATABASE_URL", use: "Postgres de Supabase (sin él se usa una base local de desarrollo)", required: true },
  { name: "APP_PASSWORD", use: "Contraseña de acceso a la app (obligatoria en producción)", required: true },
  { name: "SESSION_SECRET", use: "Secreto para firmar la sesión (recomendado)" },
  { name: "GOOGLE_MAPS_API_KEY", use: "Descubrimiento: Google Places API (New)", required: true },
  { name: "PAGESPEED_API_KEY", use: "Análisis: velocidad y móvil (PageSpeed Insights)" },
  { name: "OSM_USER_AGENT", use: "Respaldo sin clave: OpenStreetMap (Overpass/Nominatim)" },
  { name: "HUNTER_API_KEY", use: "Opcional: emails de contacto" },
  { name: "OUTSCRAPER_API_KEY", use: "Opcional: reseñas con texto" },
  { name: "ANTHROPIC_API_KEY", use: "Interpretación con IA, mensajes e informes", required: true },
];

export default async function Settings() {
  const mode = await dbMode();
  const providers = listDiscoveryProviders();
  return (
    <>
      <div className="page-head"><div><h1>Configuración</h1><p className="sub">Estado de integraciones. Nunca se muestran los valores de las claves.</p></div></div>
      <div className="stack">
        <section className="panel">
          <h2>Base de datos</h2>
          <p>{mode === "postgres" ? <span className="badge ok">Postgres (Supabase)</span> : <span className="badge warn">Base local de desarrollo (PGlite)</span>} {mode === "pglite" && <span className="muted">Los datos persisten en <span className="mono">.data/pglite</span> solo en esta máquina. Para producción define DATABASE_URL.</span>}</p>
        </section>
        <section className="panel">
          <h2>Variables de entorno</h2>
          <div className="tablewrap"><table className="t"><thead><tr><th>Variable</th><th>Uso</th><th>Estado</th></tr></thead><tbody>
            {VARS.map((v) => { const set = !!process.env[v.name]; return (
              <tr key={v.name}><td className="mono">{v.name}</td><td className="muted">{v.use}</td><td><span className={`badge ${set ? "ok" : v.required ? "warn" : ""}`}>{set ? "Configurada" : v.required ? "Falta" : "No definida"}</span></td></tr>
            ); })}
          </tbody></table></div>
        </section>
        <section className="panel">
          <h2>Proveedores de descubrimiento</h2>
          {providers.length === 0 ? <div className="empty">Ninguno registrado todavía.</div> : (
            <ul className="feed">{providers.map((p) => <li key={p.id}><span>{p.label}</span><span className={`badge ${p.isConfigured() ? "ok" : "warn"}`}>{p.isConfigured() ? "Activo" : `Falta ${p.requiredEnv.join(", ")}`}</span></li>)}</ul>
          )}
        </section>
      </div>
    </>
  );
}
