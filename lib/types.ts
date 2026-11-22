/** Tipos de dominio compartidos. Reflejan supabase/migrations/0001_init.sql */

export const CRM_STATUSES = [
  "new", "analyzed", "priority", "contacted", "replied", "meeting", "proposal", "won", "lost",
] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];

export const CRM_LABELS: Record<CrmStatus, string> = {
  new: "Nueva",
  analyzed: "Analizada",
  priority: "Prioritaria",
  contacted: "Contactada",
  replied: "Respondió",
  meeting: "Reunión",
  proposal: "Propuesta",
  won: "Ganada",
  lost: "Perdida",
};

export type Confidence = "low" | "medium" | "high";
export const CONFIDENCE_LABELS: Record<Confidence, string> = { low: "Baja", medium: "Media", high: "Alta" };

export type MessageChannel = "email" | "linkedin" | "whatsapp";
export const CHANNEL_LABELS: Record<MessageChannel, string> = { email: "Email", linkedin: "LinkedIn", whatsapp: "WhatsApp" };

export type SearchStatus = "pending" | "running" | "completed" | "failed";

export interface Socials {
  instagram?: string; facebook?: string; linkedin?: string; tiktok?: string; youtube?: string; x?: string; [k: string]: string | undefined;
}

export interface Company {
  id: string;
  search_id: string | null;
  name: string;
  niche: string | null;
  category: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  rating: number | null;
  review_count: number | null;
  opening_hours: unknown;
  socials: Socials;
  description: string | null;
  size_hint: string | null;
  crm_status: CrmStatus;
  owner: string | null;
  next_action: string | null;
  follow_up_date: string | null;
  score: number | null;
  score_confidence: Confidence | null;
  opportunity_count: number;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenceItem { text: string; source: string; url?: string }

export interface Opportunity {
  id: string;
  company_id: string;
  analysis_id: string | null;
  problem_key: string;
  title: string;
  problem: string;
  evidence: EvidenceItem[];
  consequence: string;
  solution: string;
  service: string;
  impact: string;
  impact_level: Confidence;
  severity: number;
  confidence: Confidence;
  created_at: string;
}

export interface Analysis {
  id: string;
  company_id: string;
  summary: string;
  signals: Record<string, unknown>;
  website_snapshot: Record<string, unknown> | null;
  model: string | null;
  confidence: Confidence;
  created_at: string;
}

export interface ScoreFactor {
  factor: string;
  /** peso máximo del factor en puntos */
  weight: number;
  /** puntos otorgados (0..weight) */
  points: number;
  explanation: string;
}
export interface CompanyScore {
  id: string;
  company_id: string;
  total: number;
  confidence: Confidence;
  breakdown: ScoreFactor[];
  method: string;
  created_at: string;
}

export interface Message {
  id: string; company_id: string; channel: MessageChannel; subject: string | null; body: string;
  evidence_used: EvidenceItem[]; created_at: string;
}

export interface Report { id: string; company_id: string; title: string; content: unknown; pdf_path: string | null; created_at: string }
export interface Note { id: string; company_id: string; body: string; author: string | null; created_at: string }
export interface Activity {
  id: string; company_id: string | null; search_id: string | null; type: string; description: string;
  meta: Record<string, unknown>; created_at: string; company_name?: string | null;
}
export interface Search {
  id: string; niche: string; location: string; target_count: number; status: SearchStatus;
  provider: string | null; found_count: number; error: string | null;
  created_at: string; started_at: string | null; finished_at: string | null;
}
