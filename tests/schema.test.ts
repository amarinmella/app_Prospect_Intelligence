import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../lib/db/migrate.ts";

test("las migraciones se aplican una sola vez y crean el esquema CRM", async () => {
  const db = new PGlite();
  const ex = { exec: async (t: string) => { await db.exec(t); }, query: async (t: string, p?: unknown[]) => (await db.query(t, p as never[])).rows as never };
  assert.deepEqual(await runMigrations(ex), ["0001_init.sql"]);
  assert.deepEqual(await runMigrations(ex), []);
  const c = (await db.query<{ id: string }>("insert into companies(name) values ('x') returning id")).rows[0];
  const r = (await db.query<{ crm_status: string }>("select crm_status from companies where id=$1", [c.id])).rows[0];
  assert.equal(r.crm_status, "new");
  await assert.rejects(db.query("update companies set score = 101"));
});
