import { NextResponse } from "next/server";
import type { ZodError } from "zod";

interface FieldError {
  field: string;
  message: string;
}

/**
 * Format a ZodError into a structured 400 response with field-level messages.
 *
 * Response shape:
 * { error: "Validering feilet", errors: [{ field: "companyId", message: "Må være en gyldig UUID" }] }
 */
export function zodError(err: ZodError): NextResponse {
  const errors: FieldError[] = err.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    message: issue.message,
  }));

  return NextResponse.json(
    { error: "Validering feilet", errors },
    { status: 400 }
  );
}
