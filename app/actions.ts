"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { COOKIE, sessionToken, timingSafeEqual } from "@/lib/auth";
import { createSearch } from "@/lib/repo/searches";
import { updateCrm, deleteCompany } from "@/lib/repo/companies";
import { addNote } from "@/lib/repo/analysis";
import { analyzeCompany, generateMessage, generateReport, runSearch, type StepResult } from "@/lib/pipeline";
import { CRM_STATUSES, type CrmStatus, type MessageChannel } from "@/lib/types";

export async function login(fd: FormData) {
  const expected = await sessionToken();
  const given = String(fd.get("password") ?? "");
  if (!expected || !timingSafeEqual(String(process.env.APP_PASSWORD), given)) redirect("/login?error=1");
  (await cookies()).set(COOKIE, expected, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

const SearchSchema = z.object({
  niche: z.string().trim().min(2, "Indica el tipo de negocio").max(120),
  location: z.string().trim().min(2, "Indica la ubicación").max(120),
  count: z.coerce.number().int().min(1).max(500),
});

export async function newSearch(fd: FormData) {
  const p = SearchSchema.safeParse({ niche: fd.get("niche"), location: fd.get("location"), count: fd.get("count") });
  if (!p.success) redirect("/searches?error=" + encodeURIComponent(p.error.issues[0].message));
  const s = await createSearch(p.data.niche, p.data.location, p.data.count);
  await runSearch(s.id); // el resultado (incluye bloqueos) queda en searches.status/error
  revalidatePath("/", "layout");
  redirect("/searches");
}

export async function rerunSearch(fd: FormData) {
  await runSearch(String(fd.get("id")));
  revalidatePath("/", "layout");
}

function flash(path: string, r: StepResult) {
  revalidatePath("/", "layout");
  redirect(`${path}?${r.ok ? "ok" : "warn"}=${encodeURIComponent(r.message)}`);
}

export async function actAnalyze(fd: FormData) {
  const id = String(fd.get("id"));
  flash(`/companies/${id}`, await analyzeCompany(id));
}
export async function actMessage(fd: FormData) {
  const id = String(fd.get("id"));
  const ch = z.enum(["email", "linkedin", "whatsapp"]).parse(fd.get("channel")) as MessageChannel;
  flash(`/companies/${id}`, await generateMessage(id, ch));
}
export async function actReport(fd: FormData) {
  const id = String(fd.get("id"));
  flash(`/companies/${id}`, await generateReport(id));
}

const CrmSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(CRM_STATUSES).optional(),
  owner: z.string().max(80).optional(),
  next_action: z.string().max(300).optional(),
  follow_up_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
});

export async function saveCrm(fd: FormData) {
  const raw = Object.fromEntries(["id", "status", "owner", "next_action", "follow_up_date"].filter((k) => fd.has(k)).map((k) => [k, String(fd.get(k))]));
  const p = CrmSchema.parse(raw);
  await updateCrm(p.id, { crm_status: p.status as CrmStatus | undefined, owner: p.owner, next_action: p.next_action, follow_up_date: p.follow_up_date });
  revalidatePath("/", "layout");
}

export async function saveNote(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const body = z.string().trim().min(1).max(4000).parse(fd.get("body"));
  await addNote(id, body, String(fd.get("author") || "") || null);
  revalidatePath(`/companies/${id}`);
}

export async function removeCompany(fd: FormData) {
  await deleteCompany(z.string().uuid().parse(fd.get("id")));
  revalidatePath("/", "layout");
  redirect("/companies");
}
