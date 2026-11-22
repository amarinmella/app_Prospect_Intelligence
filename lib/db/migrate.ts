import fs from "node:fs/promises";
import path from "node:path";

export interface Executor {
  exec(text: string): Promise<void>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

/** Aplica en orden los .sql de supabase/migrations que aún no estén registrados. */
export async function runMigrations(db: Executor, dir = path.join(process.cwd(), "supabase", "migrations")) {
  await db.exec("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const applied = new Set((await db.query<{ name: string }>("select name from schema_migrations")).map((r) => r.name));
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const done: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(dir, file), "utf8");
    await db.exec("begin;\n" + sql + "\ninsert into schema_migrations(name) values ('" + file.replace(/'/g, "''") + "') on conflict do nothing;\ncommit;");
    done.push(file);
  }
  return done;
}
