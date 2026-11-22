import type { Analysis, Company, EvidenceItem, MessageChannel, Opportunity } from "../types";

/**
 * CONTRATO · Mensajes personalizados.
 * Debe usar evidencia real del análisis (no plantillas con {nombre}), ser breve, abrir conversación
 * y NO inventar información. `evidenceUsed` lista qué datos reales respaldan el mensaje.
 */
export interface OutreachInput {
  company: Company;
  analysis: Analysis | null;
  opportunities: Opportunity[];
  channel: MessageChannel;
}
export interface OutreachDraft {
  channel: MessageChannel;
  subject?: string;      // solo email
  body: string;
  evidenceUsed: EvidenceItem[];
}
export interface OutreachGenerator {
  generate(input: OutreachInput): Promise<OutreachDraft>;
}
