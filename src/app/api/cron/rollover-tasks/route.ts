import { NextResponse, type NextRequest } from "next/server";
import { rolloverOverdueTasks } from "@/lib/services/task-rollover";

/**
 * Server-side, idempotent daily task rollover (spec: don't rely solely on
 * a browser opening the page). Vercel Cron hits this once a day; it also
 * runs opportunistically on /tasks and /employee/tasks page loads as a
 * safety net — both paths call the same idempotent function, so no
 * duplicate rollover/log rows regardless of how many times or from how
 * many places it fires.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const result = await rolloverOverdueTasks();
  return NextResponse.json({ ok: true, ...result });
}
