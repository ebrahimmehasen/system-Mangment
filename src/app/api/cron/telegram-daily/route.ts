import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { buildDigest } from "@/lib/services/telegram-bot";
import { sendTelegramMessage } from "@/lib/telegram";

/** Morning digest to every linked Telegram chat. One light query set per linked user, once a day. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const links = await prisma.telegramLink.findMany({
    where: { chatId: { not: null } },
    include: { user: { select: { id: true, name: true } } },
  });

  let sent = 0;
  let skippedEmpty = 0;
  let failed = 0;
  for (const link of links) {
    try {
      const digest = await buildDigest(link.user.id, link.user.name);
      if (!digest) {
        skippedEmpty++;
        continue;
      }
      const res = await sendTelegramMessage(link.chatId!, digest);
      if (res.ok) sent++;
      else {
        failed++;
        // The user blocked the bot / left: drop the dead link so we stop trying.
        if (res.blocked) {
          await prisma.telegramLink.update({ where: { id: link.id }, data: { chatId: null, linkedAt: null } });
        }
      }
    } catch (err) {
      failed++;
      console.error("telegram digest failed", link.userId, err);
    }
  }

  return NextResponse.json({ ok: true, linked: links.length, sent, skippedEmpty, failed });
}
