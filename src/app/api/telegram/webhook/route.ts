import { NextResponse, type NextRequest } from "next/server";
import { handleBotMessage } from "@/lib/services/telegram-bot";
import { isValidWebhookSecret, sendTelegramMessage } from "@/lib/telegram";

interface TelegramUpdate {
  message?: { text?: string; chat?: { id?: number; type?: string } };
}

/**
 * Telegram webhook. Public by necessity (no Supabase session), so it is
 * authenticated by the secret token Telegram echoes in a header; with no
 * secret configured it rejects everything.
 */
export async function POST(request: NextRequest) {
  if (!isValidWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    const chat = update.message?.chat;
    const text = update.message?.text;
    // Private chats only: a group must never be linked to a person's account.
    if (chat?.type === "private" && chat.id !== undefined && text) {
      const reply = await handleBotMessage(String(chat.id), text);
      await sendTelegramMessage(String(chat.id), reply);
    }
  } catch (err) {
    // Always answer 200 so Telegram does not retry the same update forever.
    console.error("telegram webhook failed", err);
  }
  return NextResponse.json({ ok: true });
}
