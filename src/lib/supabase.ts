import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn("Supabase URL or Service Role Key missing; file storage will fail.");
}

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: false },
      })
    : null;

export const UPLOAD_BUCKET = "imports";
export const ATTACHMENTS_BUCKET = "attachments";
