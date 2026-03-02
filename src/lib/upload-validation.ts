/** Max file size for attachments (PDFs, images, documents) */
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB

/** Max file size for data imports (CSV, Excel, XML) */
export const MAX_IMPORT_SIZE = 50 * 1024 * 1024; // 50 MB

const MAX_FILE_SIZE = MAX_ATTACHMENT_SIZE;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/zip",
  "application/xml",
  "text/xml",
]);

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUploadedFile(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Filen "${file.name}" er for stor (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
    };
  }

  const mime = file.type || "application/octet-stream";
  if (mime !== "application/octet-stream" && !ALLOWED_MIME_TYPES.has(mime)) {
    return {
      valid: false,
      error: `Filtypen "${mime}" er ikke tillatt for "${file.name}".`,
    };
  }

  return { valid: true };
}

const ALLOWED_IMPORT_TYPES = new Set([
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/xml",
  "text/xml",
]);

export function validateImportFile(file: File): ValidationResult {
  if (file.size > MAX_IMPORT_SIZE) {
    return {
      valid: false,
      error: `Filen "${file.name}" er for stor (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks ${MAX_IMPORT_SIZE / 1024 / 1024} MB for import.`,
    };
  }

  const mime = file.type || "application/octet-stream";
  if (mime !== "application/octet-stream" && !ALLOWED_IMPORT_TYPES.has(mime)) {
    return {
      valid: false,
      error: `Filtypen "${mime}" støttes ikke for import. Bruk CSV, Excel (.xlsx/.xls) eller CAMT.053 (XML).`,
    };
  }

  return { valid: true };
}

/**
 * Sanitizes a filename to prevent path traversal and other attacks.
 * Removes directory separators, null bytes, and control characters.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[\\/]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/^\.+/, "_")
    .trim()
    .slice(0, 255) || "unnamed";
}
