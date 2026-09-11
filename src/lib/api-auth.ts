import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Auth check for admin-only API route handlers (not Server Components/
 * Actions — those use requireAdmin() in src/lib/auth.ts, which redirects).
 * Returns either `{ user }` to proceed, or `{ response }` — a ready-to-
 * return 401/403 NextResponse — when the caller isn't an authenticated
 * admin. Every export/download API route in this app carries company-wide
 * or another person's data, so none of them should be reachable by an
 * employee-portal login even though no employee-facing page links to them.
 */
export async function requireAdminApi(): Promise<
  | { user: { id: string; email: string }; response?: undefined }
  | { user?: undefined; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "غير مصرّح" }, { status: 401 }) };
  }

  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (profile?.role !== "admin") {
    return { response: NextResponse.json({ error: "غير مصرّح" }, { status: 403 }) };
  }

  return { user: { id: user.id, email: user.email ?? "" } };
}
