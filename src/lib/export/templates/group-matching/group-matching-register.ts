import { registerTemplate } from "../../registry";
import type {
  GroupMatchingExportPayload,
  GroupMatchingExportViewModel,
  ExportContext,
} from "../../types";
import { buildGroupMatchingViewModel } from "./group-matching-viewmodel";
import { renderGroupMatchingPdf } from "./group-matching-pdf";

registerTemplate("group-matching", {
  async buildViewModel(payload, context: ExportContext) {
    return buildGroupMatchingViewModel(
      payload as GroupMatchingExportPayload,
      context
    );
  },
  async renderPdf(vm) {
    return renderGroupMatchingPdf(vm as GroupMatchingExportViewModel);
  },
});
