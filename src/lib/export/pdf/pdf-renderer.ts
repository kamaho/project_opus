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

export async function renderPdf(
  docDefinition: TDocumentDefinitions
): Promise<Buffer> {
  const doc = await printer.createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
