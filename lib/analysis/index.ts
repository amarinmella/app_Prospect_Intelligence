import { NotImplementedYetError } from "../errors";
import type { Company } from "../types";
import type { OpportunityDetector, WebsiteAnalyzer, WebsiteAnalysis, OpportunityDraft } from "./types";

export type { OpportunityDetector, OpportunityDraft, WebsiteAnalysis, WebsiteAnalyzer } from "./types";

/**
 * Punto de enganche: el hilo de análisis reemplaza estas dos implementaciones
 * (o las asigna desde lib/analysis/<impl>.ts) sin tocar el resto de la app.
 */
export const websiteAnalyzer: WebsiteAnalyzer = {
  async analyze(_company: Company): Promise<WebsiteAnalysis> {
    throw new NotImplementedYetError("analysis/websiteAnalyzer");
  },
};

export const opportunityDetector: OpportunityDetector = {
  async detect(_company: Company, _analysis: WebsiteAnalysis): Promise<OpportunityDraft[]> {
    throw new NotImplementedYetError("analysis/opportunityDetector");
  },
};
