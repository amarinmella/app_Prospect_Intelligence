import { getReport } from "@/lib/repo/analysis";
import { getCompany } from "@/lib/repo/companies";
import { reportBuilder } from "@/lib/reports";
import type { ReportContent } from "@/lib/reports/types";
import { errorMessage, NotImplementedYetError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const report = await getReport(id);
  if (!report) return new Response("Informe no encontrado", { status: 404 });
  const company = await getCompany(report.company_id);
  if (!company) return new Response("Empresa no encontrada", { status: 404 });
  try {
    const pdf = await reportBuilder.renderPdf(report.content as ReportContent, company);
    return new Response(Buffer.from(pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="informe-${company.name.replace(/[^\w-]+/g, "_")}.pdf"` },
    });
  } catch (e) {
    return new Response(errorMessage(e), { status: e instanceof NotImplementedYetError ? 501 : 500 });
  }
}
