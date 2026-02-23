import type { ExportRequest, ExportResult, ExportContext } from "./types";
import { getTemplate } from "./registry";

// Ensure templates are registered on first import
import "./templates/mva/mva-register";
import "./templates/matching/matching-register";

export async function generateExport(
  request: ExportRequest,
  context: ExportContext
): Promise<ExportResult> {
  const { module, format } = request;

  const template = getTemplate(module, format);
  if (!template) {
    throw new Error(`Ingen template registrert for ${module}/${format}`);
  }

  const payload = module === "mva" ? request.mvaData : request.matchingParams;
  const viewModel = await template.buildViewModel(payload, context);

  let buffer: Buffer;
  let mimeType: string;
  let ext: string;

  if (format === "pdf") {
    buffer = await template.renderPdf!(viewModel);
    mimeType = "application/pdf";
    ext = "pdf";
  } else {
    buffer = await template.renderXlsx!(viewModel);
    mimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    ext = "xlsx";
  }

  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `${module}-rapport-${datePart}.${ext}`;

  return { buffer, fileName, mimeType };
}
