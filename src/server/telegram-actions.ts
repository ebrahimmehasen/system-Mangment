"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { getBotUsername } from "@/lib/telegram";
import { generateLinkCode, hashLinkCode, LINK_CODE_TTL_MINUTES } from "@/lib/services/telegram-bot";

export interface TelegramLinkResult {
  error?: string;
  url?: string;
  expiresInMinutes?: number;
}

/** Creates a one-time code for the signed-in user and returns the t.me deep link that completes the link. */
export async function createTelegramLinkAction(): Promise<TelegramLinkResult> {
  const user = await requireUser();

  if (!process.env.TELEGRAM_BOT_TOKEN) return { error: "بوت تيليجرام لسه مش متضبط على السيرفر." };
  const username = await getBotUsername();
  if (!username) return { error: "تعذّر الوصول لبوت تيليجرام. اتأكد من الـ token." };

  const code = generateLinkCode();
  const data = {
    codeHash: hashLinkCode(code),
    codeExpiresAt: new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60_000),
  };
  await prisma.telegramLink.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  return { url: `https://t.me/${username}?start=${code}`, expiresInMinutes: LINK_CODE_TTL_MINUTES };
}

export async function unlinkTelegramAction(): Promise<{ error?: string }> {
  const user = await requireUser();
  await prisma.telegramLink.updateMany({
    where: { userId: user.id },
    data: { chatId: null, linkedAt: null, codeHash: null, codeExpiresAt: null },
  });
  revalidatePath("/telegram");
  revalidatePath("/employee/telegram");
  return {};
}
