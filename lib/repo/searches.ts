import "server-only";
import { query, queryOne } from "../db/client";
import type { Search } from "../types";
import { logActivity } from "./activity";

export async function createSearch(niche: string, location: string, targetCount: number): Promise<Search> {
  const s = await queryOne<Search>("insert into searches (niche, location, target_count) values ($1,$2,$3) returning *", [niche, location, targetCount]);
  await logActivity({ searchId: s!.id, type: "search_created", description: `Búsqueda creada: ${niche} en ${location}` });
  return s!;
}
export async function getSearch(id: string): Promise<Search | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return queryOne<Search>("select * from searches where id = $1", [id]);
}
export async function listSearches(limit = 50): Promise<Search[]> {
  return query<Search>(`select * from searches order by created_at desc limit ${limit}`);
}
export async function setSearchState(id: string, patch: { status: Search["status"]; provider?: string | null; error?: string | null; found_count?: number }) {
  await query(
    `update searches set status = $2::search_status, provider = coalesce($3, provider), error = $4,
       found_count = coalesce($5, found_count),
       started_at = case when $2::text = 'running' then now() else started_at end,
       finished_at = case when $2::text in ('completed','failed') then now() else finished_at end
     where id = $1`, [id, patch.status, patch.provider ?? null, patch.error ?? null, patch.found_count ?? null]);
}
