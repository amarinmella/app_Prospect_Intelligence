import "server-only";
import { query } from "../db/client";
import type { Activity } from "../types";

export async function logActivity(a: { companyId?: string | null; searchId?: string | null; type: string; description: string; meta?: Record<string, unknown> }) {
  await query("insert into activities (company_id, search_id, type, description, meta) values ($1,$2,$3,$4,$5)",
    [a.companyId ?? null, a.searchId ?? null, a.type, a.description, JSON.stringify(a.meta ?? {})]);
}

export async function recentActivity(limit = 15): Promise<Activity[]> {
  return query<Activity>(
    `select a.*, c.name as company_name from activities a left join companies c on c.id = a.company_id
     order by a.created_at desc limit ${Math.min(limit, 100)}`);
}

export async function companyActivity(companyId: string, limit = 30): Promise<Activity[]> {
  return query<Activity>("select * from activities where company_id = $1 order by created_at desc limit " + limit, [companyId]);
}
