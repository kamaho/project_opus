import { registerTemplate } from "../../registry";
import type { ExportContext } from "../../types";
import {
  buildComparisonViewModel,
  type ComparisonExportPayload,
  type ComparisonExportViewModel,
} from "./comparison-viewmodel";
import { renderComparisonPdf } from "./comparison-pdf";
import { renderComparisonXlsx } from "./comparison-xlsx";

registerTemplate("comparison", {
  async buildViewModel(payload, context: ExportContext) {
    return buildComparisonViewModel(payload as ComparisonExportPayload, context);
  },
  async renderPdf(vm) {
    return renderComparisonPdf(vm as ComparisonExportViewModel);
  },
  async renderXlsx(vm) {
    return renderComparisonXlsx(vm as ComparisonExportViewModel);
  },
});
