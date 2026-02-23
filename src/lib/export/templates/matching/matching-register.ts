import { registerTemplate } from "../../registry";
import type { MatchingExportPayload, MatchingExportViewModel, ExportContext } from "../../types";
import { buildMatchingViewModel } from "./matching-viewmodel";
import { renderMatchingPdf } from "./matching-pdf";
import { renderMatchingXlsx } from "./matching-xlsx";

registerTemplate("matching", {
  async buildViewModel(payload, context: ExportContext) {
    return buildMatchingViewModel(payload as MatchingExportPayload, context);
  },
  async renderPdf(vm) {
    return renderMatchingPdf(vm as MatchingExportViewModel);
  },
  async renderXlsx(vm) {
    return renderMatchingXlsx(vm as MatchingExportViewModel);
  },
});
