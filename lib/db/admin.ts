import "server-only";

// Service-role Supabase client: every write goes through server code with it (D2). Never import
// this from a client component; `server-only` makes that a build error.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

let client: SupabaseClient | undefined;

export function adminDb(): SupabaseClient {
  client ??= createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}
