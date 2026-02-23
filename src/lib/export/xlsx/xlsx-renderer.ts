import * as XLSX from "xlsx";

export interface WorkbookBuilder {
  wb: XLSX.WorkBook;
}

export function createWorkbook(): WorkbookBuilder {
  return { wb: XLSX.utils.book_new() };
}

export function toBuffer(builder: WorkbookBuilder): Buffer {
  const buf = XLSX.write(builder.wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}
