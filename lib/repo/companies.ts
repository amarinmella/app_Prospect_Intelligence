import "server-only";
import { query, queryOne } from "../db/client";
import type { Company, CrmStatus } from "../types";
import { logActivity } from "./activity";
import type { DiscoveredCompany } from "../discovery/types";

export interface CompanyFilters {
  q?: string;
  niche?: string;
  location?: string;
  scoreMin?: number;
  scoreMax?: number;
  oppsMin?: number;
  problem?: string;
  service?: string;
  status?: CrmStatus;
  ratingMin?: number;
  reviewsMin?: number;
  searchId?: string;
  sort?: "score" | "name" | "rating" | "reviews" | "created" | "follow_up";
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

const SORTS: Record<string, string> = {
  score: "c.score",
  name: "lower(c.name)",
  rating: "c.rating",
  reviews: "c.review_count",
  created: "c.created_at",
  follow_up: "c.follow_up_date",
};

export async function listCompanies(f: CompanyFilters = {}): Promise<{ rows: Company[]; total: number }> {
  const where: string[] = [];
  const p: unknown[] = [];
  const add = (sql: string, v: unknown) => { p.push(v); where.push(sql.replaceAll("$?", `$${p.length}`)); };

  if (f.q) add("(c.name ilike $? or c.website ilike $? or c.address ilike $?)", `%${f.q}%`);
  if (f.niche) add("(c.niche ilike $? or c.category ilike $?)", `%${f.niche}%`);
  if (f.location) add("(c.city ilike $? or c.address ilike $? or c.region ilike $?)", `%${f.location}%`);
  if (f.scoreMin != null) add("c.score >= $?", f.scoreMin);
  if (f.scoreMax != null) add("c.score <= $?", f.scoreMax);
  if (f.oppsMin != null) add("c.opportunity_count >= $?", f.oppsMin);
  if (f.status) add("c.crm_status = $?", f.status);
  if (f.ratingMin != null) add("c.rating >= $?", f.ratingMin);
  if (f.reviewsMin != null) add("c.review_count >= $?", f.reviewsMin);
  if (f.searchId) add("c.search_id = $?", f.searchId);
  if (f.problem) add("exists (select 1 from opportunities o where o.company_id = c.id and o.problem_key = $?)", f.problem);
  if (f.service) add("exists (select 1 from opportunities o where o.company_id = c.id and o.service = $?)", f.service);

  const whereSql = where.length ? "where " + where.join(" and ") : "";
  const order = `${SORTS[f.sort ?? "score"] ?? SORTS.score} ${f.dir === "asc" ? "asc" : "desc"} nulls last, c.created_at desc`;
  const limit = Math.min(f.limit ?? 50, 200);
  const offset = f.offset ?? 0;

  const rows = await query<Company>(`select c.* from companies c ${whereSql} order by ${order} limit ${limit} offset ${offset}`, p);
  const total = await queryOne<{ n: number }>(`select count(*)::int as n from companies c ${whereSql}`, p);
  return { rows, total: total?.n ?? 0 };
}

export async function getCompany(id: string): Promise<Company | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return queryOne<Company>("select * from companies where id = $1", [id]);
}

export async function distinctValues(): Promise<{ niches: string[]; problems: { key: string; title: string }[]; services: string[] }> {
  const niches = await query<{ v: string }>("select distinct coalesce(niche, category) as v from companies where coalesce(niche, category) is not null order by 1");
  const problems = await query<{ key: string; title: string }>("select problem_key as key, min(title) as title from opportunities group by problem_key order by 2");
  const services = await query<{ v: string }>("select distinct service as v from opportunities order by 1");
  return { niches: niches.map((r) => r.v), problems, services: services.map((r) => r.v) };
}

/** Inserta empresas descubiertas evitando duplicados por (fuente, id externo) o sitio web. */
export async function insertDiscovered(searchId: string, niche: string, provider: string, list: DiscoveredCompany[]): Promise<number> {
  let inserted = 0;
  for (const d of list) {
    const dup = await queryOne<{ id: string }>(
      `select company_id as id from company_sources where provider = $1 and external_id = $2
       union select id from companies where $3::text is not null and lower(website) = lower($3::text) limit 1`,
      [provider, d.externalId, d.website ?? null],
    );
    if (dup) continue;
    const row = await queryOne<{ id: string }>(
      `insert into companies (search_id, name, niche, category, website, address, city, region, country, lat, lng,
         phone, email, rating, review_count, opening_hours, socials, description, size_hint)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning id`,
      [searchId, d.name, niche, d.category ?? null, d.website ?? null, d.address ?? null, d.city ?? null, d.region ?? null,
        d.country ?? null, d.lat ?? null, d.lng ?? null, d.phone ?? null, d.email ?? null, d.rating ?? null,
        d.reviewCount ?? null, d.openingHours ? JSON.stringify(d.openingHours) : null, JSON.stringify(d.socials ?? {}),
        d.description ?? null, d.sizeHint ?? null],
    );
    await query(
      "insert into company_sources (company_id, provider, external_id, url, raw) values ($1,$2,$3,$4,$5)",
      [row!.id, provider, d.externalId, d.sourceUrl ?? null, d.raw ? JSON.stringify(d.raw) : null],
    );
    inserted++;
  }
  return inserted;
}

export interface CrmUpdate {
  crm_status?: CrmStatus;
  owner?: string | null;
  next_action?: string | null;
  follow_up_date?: string | null;
}

export async function updateCrm(id: string, u: CrmUpdate): Promise<void> {
  const prev = await getCompany(id);
  if (!prev) throw new Error("Empresa no encontrada");
  const sets: string[] = [];
  const p: unknown[] = [];
  for (const [k, v] of Object.entries(u)) {
    if (v === undefined) continue;
    p.push(v === "" ? null : v);
    sets.push(`${k} = $${p.length}`);
  }
  if (!sets.length) return;
  p.push(id);
  await query(`update companies set ${sets.join(", ")} where id = $${p.length}`, p);
  if (u.crm_status && u.crm_status !== prev.crm_status) {
    await logActivity({ companyId: id, type: "status_changed", description: `${prev.name}: ${prev.crm_status} → ${u.crm_status}`, meta: { from: prev.crm_status, to: u.crm_status } });
  }
  if (u.follow_up_date !== undefined || u.next_action !== undefined || u.owner !== undefined) {
    await logActivity({ companyId: id, type: "followup_updated", description: `Seguimiento actualizado en ${prev.name}` });
  }
}

export async function deleteCompany(id: string): Promise<void> {
  await query("delete from companies where id = $1", [id]);
}
