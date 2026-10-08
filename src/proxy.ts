import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// Next.js 16: the "middleware" convention was renamed to "proxy".
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // /api/telegram/* is excluded too: Telegram calls the webhook with a secret header, not a session.
    // /api/cron/* is excluded — Vercel Cron hits it with no Supabase
    // session cookie; that route checks its own CRON_SECRET instead.
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/telegram|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
