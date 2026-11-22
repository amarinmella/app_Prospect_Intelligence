import type { Company } from "../types";

export interface Reputation {
  rating: number | null;
  reviewCount: number | null;
  level: "unknown" | "weak" | "fair" | "strong";
  note: string;
  /** Hoy solo llegan rating y nº de reseñas (Places). Responder reseñas no es verificable sin textos de reseñas. */
  repliesVerifiable: false;
}

export function assessReputation(c: Pick<Company, "rating" | "review_count">): Reputation {
  const { rating, review_count: n } = c;
  if (rating == null || n == null) return { rating: rating ?? null, reviewCount: n ?? null, level: "unknown", note: "Sin datos de reseñas en la fuente.", repliesVerifiable: false };
  let level: Reputation["level"] = "fair";
  if (n < 15) level = "weak"; else if (rating >= 4.4 && n >= 50) level = "strong"; else if (rating < 4.0) level = "weak";
  return { rating, reviewCount: n, level, note: `${rating.toFixed(1)}/5 con ${n} reseñas.`, repliesVerifiable: false };
}
