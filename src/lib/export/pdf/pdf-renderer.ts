import type { TDocumentDefinitions, TFontDictionary } from "pdfmake/interfaces";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PdfPrinter = require("pdfmake/js/Printer").default;

const fontsDir = path.join(
  process.cwd(),
  "node_modules/pdfmake/build/fonts/Roboto"
);

const fonts: TFontDictionary = {
  Roboto: {
    normal: path.join(fontsDir, "Roboto-Regular.ttf"),
    bold: path.join(fontsDir, "Roboto-Medium.ttf"),
    italics: path.join(fontsDir, "Roboto-Italic.ttf"),
    bolditalics: path.join(fontsDir, "Roboto-MediumItalic.ttf"),
  },
};

const printer = new PdfPrinter(fonts);

/** Small "Revizo" label at center bottom on every report page (via background) */
const REVIZO_WATERMARK_FONT_SIZE = 14;
const REVIZO_WATERMARK_BOTTOM_MARGIN = 18;

function revizoWatermarkBackground(
  _currentPage: number,
  pageSize: { width: number; height: number }
) {
  const y = pageSize.height - REVIZO_WATERMARK_BOTTOM_MARGIN;
  return {
    absolutePosition: { x: 0, y },
    width: pageSize.width,
    text: "Revizo",
    fontSize: REVIZO_WATERMARK_FONT_SIZE,
    color: "#999999",
    opacity: 0.12,
    bold: true,
    alignment: "center" as const,
  };
}

export async function renderPdf(
  docDefinition: TDocumentDefinitions
): Promise<Buffer> {
  const def = docDefinition as TDocumentDefinitions & { background?: unknown };
  const docWithWatermark: TDocumentDefinitions = {
    ...docDefinition,
    watermark: undefined,
    background:
      def.background != null ? def.background : revizoWatermarkBackground,
  };
  const doc = await printer.createPdfKitDocument(docWithWatermark);
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
