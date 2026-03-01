import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { MatchingExportViewModel } from "../../types";
import { renderPdf } from "../../pdf/pdf-renderer";
import {
  coverPage,
  brandedReportHeader,
  reportFooter,
  reportMetaBlock,
  dataTable,
  dataTableWithFooter,
  statusBlock,
  formatNok,
  formatDateTime,
  getRevizoLogoDataUrl,
} from "../../pdf/pdf-components";

export async function renderMatchingPdf(
  vm: MatchingExportViewModel
): Promise<Buffer> {
  if (vm.reportType === "open") return renderOpenPdf(vm);
  return renderClosedPdf(vm);
}

// ── Open items report ──────────────────────────────────────────────

async function renderOpenPdf(vm: MatchingExportViewModel): Promise<Buffer> {
  const logoDataUrl = getRevizoLogoDataUrl();
  const logoKey = logoDataUrl ? "revizoLogo" : undefined;

  const images: Record<string, string> = {};
  if (logoDataUrl && logoKey) images[logoKey] = logoDataUrl;
  if (vm.companyLogoDataUrl) images.brandLogo = vm.companyLogoDataUrl;

  const content: Content[] = [];

  // Cover page
  content.push(
    coverPage({
      reportTitle: "Åpne poster rapport",
      companyName: vm.companyName,
      klientNavn: vm.klientNavn,
      period: vm.datoPeriode,
      generatedBy: vm.generatedBy,
      generatedAt: vm.genererTidspunkt,
      logoImageKey: logoKey,
    })
  );

  // Report header (page 2+)
  content.push(
    brandedReportHeader("Avstemmingsstatus", {
      companyName: vm.companyName,
      logoImageKey: vm.companyLogoDataUrl ? "brandLogo" : undefined,
      subtitle: vm.klientNavn,
      period: vm.datoPeriode,
    })
  );

  // Match summary
  const matchSummaryItems = [
    { label: "Matchinger utført", value: String(vm.matchCount ?? 0) },
    { label: "Transaksjoner matchet", value: String(vm.matchedTransactionCount ?? 0) },
    {
      label: "Avstemt",
      value: `${vm.matchProsent ?? 0}%`,
      highlight: (vm.matchProsent ?? 0) >= 90,
    },
  ];
  content.push({
    text: "Matching-resultat",
    fontSize: 13,
    bold: true,
    margin: [0, 0, 0, 4],
  } as Content);
  content.push(statusBlock(matchSummaryItems));

  // Saldo overview
  content.push({
    text: "Saldo",
    fontSize: 13,
    bold: true,
    margin: [0, 8, 0, 4],
  } as Content);
  content.push(
    statusBlock([
      {
        label: `${vm.set1Label} — saldo`,
        value: formatNok(vm.saldoSet1 ?? 0),
      },
      {
        label: `${vm.set1Label} — poster totalt`,
        value: String(vm.totalPosterSet1 ?? 0),
      },
      {
        label: `${vm.set2Label} — saldo`,
        value: formatNok(vm.saldoSet2 ?? 0),
      },
      {
        label: `${vm.set2Label} — poster totalt`,
        value: String(vm.totalPosterSet2 ?? 0),
      },
      {
        label: "Differanse",
        value: formatNok((vm.saldoSet1 ?? 0) + (vm.saldoSet2 ?? 0)),
        highlight: Math.abs((vm.saldoSet1 ?? 0) + (vm.saldoSet2 ?? 0)) < 0.01,
      },
    ])
  );

  // Open items section
  content.push({
    text: "Åpne poster",
    fontSize: 13,
    bold: true,
    margin: [0, 12, 0, 4],
  } as Content);
  content.push(
    statusBlock([
      { label: `${vm.set1Label} — åpne`, value: String(vm.antallSet1 ?? 0) },
      { label: `${vm.set1Label} — åpent beløp`, value: formatNok(vm.totalSet1 ?? 0) },
      { label: `${vm.set2Label} — åpne`, value: String(vm.antallSet2 ?? 0) },
      { label: `${vm.set2Label} — åpent beløp`, value: formatNok(vm.totalSet2 ?? 0) },
    ])
  );

  // Transaction tables
  const txColumns = [
    { header: "Dato", width: 65, alignment: "left" as const },
    { header: "Bilag", width: 60, alignment: "left" as const },
    { header: "Beskrivelse", width: "*", alignment: "left" as const },
    { header: "Beløp", width: 80, alignment: "right" as const },
  ];

  const toRows = (txs: typeof vm.aapneSet1) =>
    (txs ?? []).map((t) => [
      t.dato,
      t.bilag,
      t.beskrivelse,
      { text: formatNok(t.belop), color: t.belop < 0 ? "#cc0000" : "#000000" },
    ]);

  if ((vm.aapneSet1?.length ?? 0) > 0) {
    content.push({
      text: `${vm.set1Label} — åpne transaksjoner`,
      fontSize: 12,
      bold: true,
      margin: [0, 16, 0, 4],
    } as Content);
    content.push(
      dataTableWithFooter(
        txColumns,
        toRows(vm.aapneSet1),
        `${vm.set1Label} totalt:`,
        formatNok(vm.totalSet1 ?? 0),
        { zebraStripe: true }
      )
    );
  }

  if ((vm.aapneSet2?.length ?? 0) > 0) {
    content.push({
      text: `${vm.set2Label} — åpne transaksjoner`,
      fontSize: 12,
      bold: true,
      margin: [0, 16, 0, 4],
    } as Content);
    content.push(
      dataTableWithFooter(
        txColumns,
        toRows(vm.aapneSet2),
        `${vm.set2Label} totalt:`,
        formatNok(vm.totalSet2 ?? 0),
        { zebraStripe: true }
      )
    );
  }

  if ((vm.aapneSet1?.length ?? 0) === 0 && (vm.aapneSet2?.length ?? 0) === 0) {
    content.push({
      text: "Ingen åpne poster — alle transaksjoner er avstemt.",
      fontSize: 10,
      color: "#16a34a",
      bold: true,
      margin: [0, 8, 0, 0],
    } as Content);
  }

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    images: Object.keys(images).length > 0 ? images : undefined,
    footer: reportFooter(vm.generatedBy ?? "System", vm.genererTidspunkt),
    content,
  };

  return renderPdf(doc);
}

// ── Closed items report ────────────────────────────────────────────

async function renderClosedPdf(vm: MatchingExportViewModel): Promise<Buffer> {
  const logoDataUrl = getRevizoLogoDataUrl();
  const logoKey = logoDataUrl ? "revizoLogo" : undefined;

  const images: Record<string, string> = {};
  if (logoDataUrl && logoKey) images[logoKey] = logoDataUrl;
  if (vm.companyLogoDataUrl) images.brandLogo = vm.companyLogoDataUrl;

  const content: Content[] = [];

  // Cover page
  content.push(
    coverPage({
      reportTitle: "Lukkede poster rapport",
      companyName: vm.companyName,
      klientNavn: vm.klientNavn,
      period: vm.datoPeriode,
      generatedBy: vm.generatedBy,
      generatedAt: vm.genererTidspunkt,
      logoImageKey: logoKey,
    })
  );

  // Report header
  content.push(
    brandedReportHeader("Lukkede poster", {
      companyName: vm.companyName,
      logoImageKey: vm.companyLogoDataUrl ? "brandLogo" : undefined,
      subtitle: vm.klientNavn,
      period: vm.datoPeriode,
    })
  );

  const metaRows: { label: string; value: string }[] = [
    { label: "Per", value: vm.datoPeriode },
    { label: "Klient", value: vm.klientNavn },
  ];
  if (vm.generatedBy) metaRows.push({ label: "Skrevet ut av", value: vm.generatedBy });
  metaRows.push({ label: "Utskriftsdato", value: formatDateTime(vm.genererTidspunkt) });

  content.push(reportMetaBlock(metaRows));
  content.push(
    statusBlock([
      { label: "Antall matcher", value: String(vm.antallMatcher ?? 0) },
      { label: "Total matchet beløp", value: formatNok(vm.totalMatchet ?? 0) },
    ])
  );

  const matchColumns = [
    { header: "Match-dato", width: 65, alignment: "left" as const },
    { header: "Type", width: 50, alignment: "left" as const },
    { header: "Diff", width: 55, alignment: "right" as const },
    { header: `${vm.set1Label}`, width: "*", alignment: "left" as const },
    { header: `${vm.set2Label}`, width: "*", alignment: "left" as const },
  ];

  const rows = (vm.matcher ?? []).map((m) => {
    const set1Text = m.transaksjonerSet1
      .map((t) => `${t.dato} ${formatNok(t.belop)}`)
      .join("\n");
    const set2Text = m.transaksjonerSet2
      .map((t) => `${t.dato} ${formatNok(t.belop)}`)
      .join("\n");
    return [
      m.matchDato,
      m.type === "auto" ? "Auto" : "Manuell",
      {
        text: m.differanse === 0 ? "0" : formatNok(m.differanse),
        color: m.differanse !== 0 ? "#cc0000" : "#000000",
      },
      { text: set1Text || "—", fontSize: 8 },
      { text: set2Text || "—", fontSize: 8 },
    ];
  });

  if (rows.length > 0) {
    content.push(dataTable(matchColumns, rows, { zebraStripe: true }));
  } else {
    content.push({
      text: "Ingen lukkede poster i valgt periode.",
      fontSize: 10,
      color: "#666666",
      margin: [0, 12, 0, 0],
    } as Content);
  }

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    images: Object.keys(images).length > 0 ? images : undefined,
    footer: reportFooter(vm.generatedBy ?? "System", vm.genererTidspunkt),
    content,
  };

  return renderPdf(doc);
}
