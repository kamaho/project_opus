import type { MvaExportPayload, MvaExportViewModel, MvaExportLine, ExportContext } from "../../types";
import { getDifferansekategoriLabel, type MvaDifferansekategori } from "@/lib/mva/demo-data";

export function buildMvaViewModel(payload: MvaExportPayload, context?: ExportContext): MvaExportViewModel {
  const { melding, lineOverrides } = payload;

  const linjer: MvaExportLine[] = melding.linjer.map((linje) => {
    const diff = linje.beregnet - linje.bokfort;
    const override = lineOverrides[linje.mvaKode];
    const categoryValue = override?.category ?? "";
    return {
      mvaKode: linje.mvaKode,
      beskrivelse: linje.beskrivelse,
      grunnlag: linje.grunnlag,
      sats: linje.sats,
      beregnet: linje.beregnet,
      bokfort: linje.bokfort,
      differanse: diff,
      aarsak: categoryValue
        ? getDifferansekategoriLabel(categoryValue as MvaDifferansekategori)
        : "",
      kommentar: override?.comment ?? "",
    };
  });

  const totalBeregnet = linjer.reduce((s, l) => s + l.beregnet, 0);
  const totalBokfort = linjer.reduce((s, l) => s + l.bokfort, 0);

  return {
    termin: melding.termin,
    totalBeregnet,
    totalBokfort,
    totalDifferanse: totalBeregnet - totalBokfort,
    linjer,
    genererTidspunkt: new Date().toISOString(),
    generatedBy: context?.userEmail,
  };
}
