"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";

export async function dismissAlertAction(alertKey: string): Promise<{ error?: string }> {
  const user = await requireUser();

  await prisma.alertDismissal.upsert({
    where: { userId_alertKey: { userId: user.id, alertKey } },
    update: {},
    create: { userId: user.id, alertKey },
  });

  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return {};
}
