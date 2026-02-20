/**
 * Import-scripts: kunnskap og verktøy for filtolkning og script-generering.
 * Bygget på script_builder; dokumentasjon i docs/import-scripts/.
 */

export {
  detectCamt,
  type CamtDetectionResult,
} from "./camt-detector";
export { getCamt053Script, type CamtScriptOptions } from "./camt-script";
export {
  detectDataType,
  detectDateFormat,
  detectSeparator,
  detectTextQualifier,
  guessField,
} from "./detectors";
export { parseCsvToMeta, metaToCsvConfig } from "./csv-meta";
export {
  generateCsvScript,
  configToScript,
  classifyLine,
  type ScriptGenerateOptions,
  type LineType,
} from "./script-format";
export {
  INTERNAL_FIELDS,
  SCRIPT_FIELD_LABELS,
  FIELD_ORDER,
  DATE_FORMATS,
  type InternalFieldKey,
  type ColumnMapping,
  type ParsedFileMeta,
  type SeparatorChar,
  type DataType,
} from "./types";
