import "server-only";

import { timingSafeEqual } from "node:crypto";

const API = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("Missing required environment variable: TELEGRAM_BOT_TOKEN");
  return t;
}

export type SendResult = { ok: true } | { ok: false; blocked: boolean };

/** Sends an HTML message. `blocked` = the user blocked the bot / deleted the chat, so the link is dead. */
export async function sendTelegramMessage(chatId: string, html: string): Promise<SendResult> {
  const res = await fetch(`${API}/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (res.ok) return { ok: true };
  return { ok: false, blocked: res.status === 403 };
}

let cachedUsername: string | null = null;

/** The bot's @username, for building the t.me deep link. Cached per server instance. */
export async function getBotUsername(): Promise<string | null> {
  if (cachedUsername) return cachedUsername;
  try {
    const res = await fetch(`${API}/bot${token()}/getMe`);
    const json = (await res.json()) as { ok: boolean; result?: { username?: string } };
    cachedUsername = json.ok ? (json.result?.username ?? null) : null;
  } catch {
    cachedUsername = null;
  }
  return cachedUsername;
}

/** Constant-time check of Telegram's X-Telegram-Bot-Api-Secret-Token header. Fails closed if no secret is configured. */
export function isValidWebhookSecret(header: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
