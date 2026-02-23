import type { ExportModule, ExportFormat, ExportContext } from "./types";

export interface RegisteredTemplate {
  buildViewModel: (payload: unknown, context: ExportContext) => Promise<unknown>;
  renderPdf?: (viewModel: unknown) => Promise<Buffer>;
  renderXlsx?: (viewModel: unknown) => Promise<Buffer>;
}

const registry = new Map<string, RegisteredTemplate>();

function key(module: ExportModule, _format?: ExportFormat): string {
  return module;
}

export function registerTemplate(
  module: ExportModule,
  template: RegisteredTemplate
): void {
  registry.set(key(module), template);
}

export function getTemplate(
  module: ExportModule,
  format: ExportFormat
): RegisteredTemplate | null {
  const tmpl = registry.get(key(module));
  if (!tmpl) return null;
  if (format === "pdf" && !tmpl.renderPdf) return null;
  if (format === "xlsx" && !tmpl.renderXlsx) return null;
  return tmpl;
}
