import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
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
  };
}
