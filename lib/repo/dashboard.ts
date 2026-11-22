import "server-only";
import { query, queryOne } from "../db/client";
import type { CrmStatus } from "../types";

export interface DashboardData {
  found: number;
  analyzed: number;
  priority: number;          // score >= 70
  avgScore: number | null;
  scoreBuckets: { label: string; n: number }[];
  topProblems: { key: string; title: string; n: number }[];
  topServices: { service: string; n: number; avgSeverity: number }[];
  pipeline: { status: CrmStatus; n: number }[];
  followUpsDue: number;
}

export async function dashboardData(): Promise<DashboardData> {
  const t = await queryOne<{ found: number; analyzed: number; priority: number; avg: number | null; due: number }>(
    `select count(*)::int as found,
            count(*) filter (where analyzed_at is not null)::int as analyzed,
            count(*) filter (where score >= 70)::int as priority,
            round(avg(score))::int as avg,
            count(*) filter (where follow_up_date <= current_date and crm_status not in ('won','lost'))::int as due
     from companies`);
  const buckets = await query<{ b: number; n: number }>(
    "select least(score / 20, 4) as b, count(*)::int as n from companies where score is not null group by 1");
  const labels = ["0–19", "20–39", "40–59", "60–79", "80–100"];
  const scoreBuckets = labels.map((label, i) => ({ label, n: buckets.find((x) => Number(x.b) === i)?.n ?? 0 }));
  const topProblems = await query<{ key: string; title: string; n: number }>(
    "select problem_key as key, min(title) as title, count(*)::int as n from opportunities group by problem_key order by n desc limit 8");
  const topServices = await query<{ service: string; n: number; avgSeverity: number }>(
    `select service, count(*)::int as n, round(avg(severity), 1)::float as "avgSeverity" from opportunities group by service order by n desc limit 6`);
  const pipeline = await query<{ status: CrmStatus; n: number }>(
    "select crm_status as status, count(*)::int as n from companies group by crm_status");
  return {
    found: t?.found ?? 0, analyzed: t?.analyzed ?? 0, priority: t?.priority ?? 0, avgScore: t?.avg ?? null,
    scoreBuckets, topProblems, topServices, pipeline, followUpsDue: t?.due ?? 0,
  };
}
