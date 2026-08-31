import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Privileged Supabase client using the service role key.
 * BYPASSES Row Level Security — only use in trusted server code
 * (e.g. creating auth users, generating signed URLs) after the
 * caller's session and permissions have been verified.
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
