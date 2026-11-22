import { buildReport } from "./builder";
import { renderReportPdf } from "./pdf";
import type { ReportBuilder } from "./types";

export type { ReportBuilder, ReportContent, ReportInput } from "./types";

export const reportBuilder: ReportBuilder = {
  build: buildReport,
  renderPdf: renderReportPdf,
};
