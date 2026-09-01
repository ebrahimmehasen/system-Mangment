/**
 * Create an admin user directly (bootstrap / CLI).
 *
 *   npx tsx --require dotenv/config scripts/create-admin.ts "<email>" "<password>" "<name>"
 *   (DOTENV_CONFIG_PATH=.env.local)
 *
 * In-app admin creation goes through src/server/auth-actions.ts instead.
 */
import { createClient } from "@supabase/supabase-js";

const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: create-admin.ts "<email>" "<password>" "<name>"');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name ?? "", role: "admin" },
  });

  if (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }

  console.log(`Created admin: ${data.user?.email} (${data.user?.id})`);
}

main();
