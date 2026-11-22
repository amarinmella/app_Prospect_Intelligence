import { NotImplementedYetError } from "../errors";
import type { OutreachGenerator } from "./types";

export type { OutreachDraft, OutreachGenerator, OutreachInput } from "./types";

/** Punto de enganche del hilo de mensajes. */
export const outreachGenerator: OutreachGenerator = {
  async generate() {
    throw new NotImplementedYetError("outreach");
  },
};
