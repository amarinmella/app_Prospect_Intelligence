import "server-only";
import fs from "node:fs";
import path from "node:path";
import { runMigrations, type Executor } from "./migrate";

/**
 * Capa de acceso a Postgres.
 *  - Con DATABASE_URL (Supabase o cualquier Postgres): conexión directa desde el servidor.
 *  - Sin DATABASE_URL: PGlite (Postgres real embebido) persistido en .data/pglite, útil para
 *    desarrollo local. Usa exactamente el mismo esquema (supabase/migrations).
 */

type Row = Record<string, unknown>;
interface Driver extends Executor {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  mode: "postgres" | "pglite";
}

const g = globalThis as unknown as { __piDriver?: Promise<Driver> };

async function createDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  let driver: Driver;
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { max: 5, prepare: false, onnotice: () => {} });
    driver = {
      mode: "postgres",
      exec: async (text) => {
        await sql.unsafe(text);
      },
      query: async <T,>(text: string, params: unknown[] = []) =>
        (await sql.unsafe(text, params as never[])) as unknown as T[],
    };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    const db = new PGlite(dir);
    await db.waitReady;
    driver = {
      mode: "pglite",
      exec: async (text) => {
        await db.exec(text);
      },
      query: async <T,>(text: string, params: unknown[] = []) =>
        (await db.query<T>(text, params)).rows,
    };
  }
  // Auto-migración: siempre en PGlite; en Postgres remoto solo si AUTO_MIGRATE=true
  if (driver.mode === "pglite" || process.env.AUTO_MIGRATE === "true") {
    await runMigrations(driver);
  }
  return driver;
}

function driver(): Promise<Driver> {
  if (!g.__piDriver) {
    g.__piDriver = createDriver().catch((e) => {
      g.__piDriver = undefined;
      throw e;
    });
  }
  return g.__piDriver;
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await driver()).query<T>(text, params);
}

export async function queryOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}

export async function dbMode(): Promise<"postgres" | "pglite"> {
  return (await driver()).mode;
}
