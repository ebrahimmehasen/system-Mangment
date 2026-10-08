/**
 * Registers the bot webhook with Telegram (run once after each deploy URL change).
 *   npx tsx --require dotenv/config scripts/set-telegram-webhook.ts https://your-app.vercel.app
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from the environment (.env.local via dotenv_config_path).
 */
const base = process.argv[2];
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!base || !token || !secret) {
  console.error("Usage: set-telegram-webhook.ts <https://app-url>  (needs TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in env)");
  process.exit(1);
}

async function main() {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: `${base.replace(/\/$/, "")}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ["message"],
    }),
  });
  console.log(await res.json());
}

main();
