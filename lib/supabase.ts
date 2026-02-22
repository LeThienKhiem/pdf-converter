import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Server-side Supabase client for use in Server Components and API routes. */
export function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);
