import PDFDocument from "pdfkit";
import type { Company } from "../types";
import type { ReportContent } from "./types";

const INK = "#111111", GREY = "#5f6368", LIGHT = "#e5e7eb", PANEL = "#f4f5f7", ACCENT = "#0b5cad";
const M = 56;

/** Las fuentes estándar de PDF solo cubren WinAnsi: normaliza lo que no cabe. */
export function pdfSafe(s: string): string {
  return s.replace(/[\u2192\u21d2]/g, "->").replace(/[\u201c\u201d\u00ab\u00bb]/g, '"').replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2000-\u200f\u2028-\u202f]/g, " ")
    .replace(/[^\u0009\u000a\u0020-\u00ff\u2013\u2014\u2022\u2026\u20ac]/g, "");
}
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

export async function renderReportPdf(c: ReportContent, company: Company): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: "A4", margins: { top: M, bottom: 72, left: M, right: M }, bufferPages: true, info: { Title: pdfSafe(c.title), Author: "Innova IA Studio", Subject: "Informe comercial" } });
  const chunks: Buffer[] = [];
  doc.on("data", (b: Buffer) => chunks.push(b));
  const done = new Promise<void>((res) => doc.on("end", () => res()));
  const W = doc.page.width - M * 2;
  const T = (s: string) => pdfSafe(s);
  const ensure = (h: number) => { if (doc.y + h > doc.page.height - 80) doc.addPage(); };

  const heading = (n: number, text: string) => {
    ensure(60); doc.moveDown(1.1);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ACCENT).text(`${String(n).padStart(2, "0")}  ${T(text).toUpperCase()}`, M, doc.y, { characterSpacing: 0.8 });
    const y = doc.y + 3; doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.6).strokeColor(LIGHT).stroke(); doc.y = y + 8;
  };
  const para = (s: string, o: { size?: number; color?: string; bold?: boolean; indent?: number } = {}) => {
    doc.font(o.bold ? "Helvetica-Bold" : "Helvetica").fontSize(o.size ?? 10).fillColor(o.color ?? INK).text(T(s), M + (o.indent ?? 0), doc.y, { width: W - (o.indent ?? 0), lineGap: 2.5 });
  };

  // Cabecera
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ACCENT).text("INFORME COMERCIAL", M, M, { characterSpacing: 1.2 });
  doc.moveDown(0.5).font("Helvetica-Bold").fontSize(22).fillColor(INK).text(T(company.name), M, doc.y, { width: W });
  const meta = [company.niche ?? company.category, [company.city, company.country].filter(Boolean).join(", "), company.website].filter(Boolean).join("  ·  ");
  if (meta) doc.moveDown(0.3).font("Helvetica").fontSize(9.5).fillColor(GREY).text(T(meta), M, doc.y, { width: W });
  doc.font("Helvetica").fontSize(9.5).fillColor(GREY).text(`Preparado por Innova IA Studio  ·  ${fmtDate(c.generatedAt)}`, M, doc.y + 2, { width: W });

  // Puntuación
  if (c.score) {
    doc.moveDown(0.9); const y0 = doc.y; const h = 46;
    doc.rect(M, y0, W, h).fillColor(PANEL).fill();
    doc.font("Helvetica-Bold").fontSize(24).fillColor(INK).text(String(Math.round(c.score.total)), M + 14, y0 + 9, { continued: true }).fontSize(11).fillColor(GREY).text(" / 100");
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text("Puntuación de oportunidad", M + 120, y0 + 9, { width: W - 130 });
    doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text(T(`Orientativa y heurística, no una medida científica. Confianza del análisis: ${c.score.confidence.toLowerCase()}.`), M + 120, y0 + 23, { width: W - 130 });
    doc.y = y0 + h;
  }

  let n = 1;
  heading(n++, "Situación actual");
  para(c.situation || "No se dispone de un resumen del análisis.");

  heading(n++, "Problemas encontrados");
  if (!c.problems.length) para("No se detectaron problemas justificables con la información pública disponible.", { color: GREY });
  c.problems.forEach((p, i) => { ensure(48); para(`${i + 1}. ${p.title}`, { bold: true }); para(p.detail, { color: GREY, indent: 14, size: 9.5 }); doc.moveDown(0.5); });

  heading(n++, "Evidencias");
  if (!c.evidence.length) para("Sin evidencias registradas.", { color: GREY });
  c.evidence.forEach((e) => {
    ensure(34); const y = doc.y;
    doc.rect(M, y + 2, 2, 12).fillColor(ACCENT).fill();
    para(e.text, { indent: 10, size: 9.5 });
    para(`Fuente: ${e.source}${e.url ? `  ·  ${e.url}` : ""}`, { indent: 10, size: 8, color: GREY });
    doc.moveDown(0.4);
  });

  heading(n++, "Oportunidades");
  c.opportunities.forEach((o) => { ensure(60); para(o.title, { bold: true }); para(`Solución: ${o.solution}`, { indent: 14, size: 9.5 }); para(`Impacto: ${o.impact}`, { indent: 14, size: 9.5, color: GREY }); doc.moveDown(0.5); });

  heading(n++, "Recomendaciones");
  c.recommendations.forEach((r, i) => { ensure(30); para(`${i + 1}.  ${r}`, { size: 10 }); doc.moveDown(0.3); });

  heading(n++, "Sistemas que podríamos implementar");
  if (!c.proposedSystems.length) para("Se definirán tras validar las prioridades con el negocio.", { color: GREY });
  c.proposedSystems.forEach((s) => { ensure(18); para(`•  ${s}`); });

  heading(n++, "Impacto potencial");
  para(c.potentialImpact);

  if (c.score?.factors.length) {
    heading(n++, "Cómo se calculó la puntuación");
    c.score.factors.forEach((f) => { ensure(30); para(`${f.factor}  —  ${Math.round(f.points * 10) / 10} / ${f.weight}`, { bold: true, size: 9.5 }); para(f.explanation, { size: 9, color: GREY, indent: 10 }); doc.moveDown(0.3); });
    para(`Método: ${c.score.method}.`, { size: 8.5, color: GREY });
  }

  doc.moveDown(1.2); ensure(40);
  para("Este informe se basa en información pública y análisis automatizado; las observaciones deben confirmarse con el negocio antes de tomar decisiones.", { size: 8.5, color: GREY });

  // Pie de página
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const fy = doc.page.height - 48;
    doc.page.margins.bottom = 0;
    doc.moveTo(M, fy - 6).lineTo(M + W, fy - 6).lineWidth(0.5).strokeColor(LIGHT).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(INK).text("Innova IA Studio", M, fy, { width: W / 2, lineBreak: false });
    doc.font("Helvetica").fillColor(GREY).text(`Confidencial · ${i + 1} / ${range.count}`, M + W / 2, fy, { width: W / 2, align: "right", lineBreak: false });
  }
  doc.end(); await done;
  return new Uint8Array(Buffer.concat(chunks));
}
