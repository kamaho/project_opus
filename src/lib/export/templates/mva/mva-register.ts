import { registerTemplate } from "../../registry";
import type { MvaExportPayload, MvaExportViewModel } from "../../types";
import { buildMvaViewModel } from "./mva-viewmodel";
import { renderMvaPdf } from "./mva-pdf";
import { renderMvaXlsx } from "./mva-xlsx";

registerTemplate("mva", {
  async buildViewModel(payload, context) {
    return buildMvaViewModel(payload as MvaExportPayload, context);
  },
  async renderPdf(vm) {
    return renderMvaPdf(vm as MvaExportViewModel);
  },
  async renderXlsx(vm) {
    return renderMvaXlsx(vm as MvaExportViewModel);
  },
});
