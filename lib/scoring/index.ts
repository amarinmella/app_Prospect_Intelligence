import { NotImplementedYetError } from "../errors";
import type { ScoreFn } from "./types";

export type { ScoreFn, ScoreInput, ScoreResult } from "./types";

/** Punto de enganche del hilo de scoring. */
export const scoreCompany: ScoreFn = () => {
  throw new NotImplementedYetError("scoring");
};
