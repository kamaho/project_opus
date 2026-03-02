import type { ControlResult } from "./types";
import { CONTROL_TYPE_LABELS } from "./types";
import { generateControlPdf } from "./report-pdf";
import { generateControlExcel } from "./report-xlsx";

export interface ControlReportOutput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export async function generateControlReport(
  result: ControlResult,
  format: "pdf" | "excel",
  companyName: string
): Promise<ControlReportOutput> {
  const typeLabel = CONTROL_TYPE_LABELS[result.controlType] ?? result.controlType;
  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const buffer = await generateControlPdf(result, companyName);
    return {
      buffer,
      filename: `${typeLabel} - ${companyName} - ${timestamp}.pdf`,
      mimeType: "application/pdf",
    };
  }

  const buffer = generateControlExcel(result, companyName);
  return {
    buffer,
    filename: `${typeLabel} - ${companyName} - ${timestamp}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
