/**
 * Delete a user by email (auth + mirrored public.users row).
 * Used to clean up test accounts.
 *
 *   npx tsx --require dotenv/config scripts/delete-user.ts "<email>"
 *   (DOTENV_CONFIG_PATH=.env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const [email] = process.argv.slice(2);

if (!email) {
  console.error('Usage: delete-user.ts "<email>"');
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
const prisma = new PrismaClient();

async function main() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error("listUsers failed:", error.message);
    process.exit(1);
  }
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`No auth user with email ${email}`);
    process.exit(1);
  }

  const del = await admin.auth.admin.deleteUser(user.id);
  if (del.error) {
    console.error("deleteUser failed:", del.error.message);
    process.exit(1);
  }
  await prisma.user.deleteMany({ where: { id: user.id } });
  console.log(`Deleted ${email} (${user.id})`);
  await prisma.$disconnect();
}

main();
