import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isSuperAdmin: boolean;
}

/**
 * Returns the signed-in user (from the verified Supabase session) joined
 * with the app `users` row. Redirects to /login if there is no session.
 * Use this at the top of every protected Server Component / Action.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email ?? "" },
    create: {
      id: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.name as string | undefined) ?? null,
      role: (user.user_metadata?.role as string | undefined) ?? "admin",
    },
  });

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    isSuperAdmin: profile.isSuperAdmin,
  };
}

/**
 * Like requireUser(), but also rejects a non-"admin" caller. Use this in
 * Server Actions that are admin-only in the permissions matrix (managing
 * target clients, employees, payroll, meetings, …) so an employee-portal
 * account can't invoke them directly even though the action isn't rendered
 * on any page they can reach.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/employee");
  return user;
}
