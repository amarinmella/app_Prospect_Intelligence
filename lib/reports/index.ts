import { NotImplementedYetError } from "../errors";
import type { ReportBuilder } from "./types";

export type { ReportBuilder, ReportContent, ReportInput } from "./types";

/** Punto de enganche del hilo de informes/PDF. */
export const reportBuilder: ReportBuilder = {
  async build() {
    throw new NotImplementedYetError("reports/build");
  },
  async renderPdf() {
    throw new NotImplementedYetError("reports/renderPdf");
  },
};
