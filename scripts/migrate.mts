import postgres from "postgres";
import { runMigrations } from "../lib/db/migrate.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (cadena de conexión de Supabase: Project Settings → Database).");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
const done = await runMigrations({
  exec: async (t) => {
    await sql.unsafe(t);
  },
  query: async <T,>(t: string, p: unknown[] = []) => (await sql.unsafe(t, p as never[])) as unknown as T[],
});
console.log(done.length ? `Migraciones aplicadas: ${done.join(", ")}` : "Base de datos al día.");
await sql.end();
