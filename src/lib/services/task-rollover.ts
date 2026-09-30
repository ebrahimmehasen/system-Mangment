import "server-only";

import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { ymdInTz, utcToZonedInput, zonedInputToUtc } from "@/lib/datetime";

/** Same Cairo calendar day, +1 day, same wall-clock time. DST-safe (reuses zonedInputToUtc). */
function addOneCairoDay(d: Date): Date {
  const wall = utcToZonedInput(d); // "YYYY-MM-DDTHH:mm"
  const [datePart, timePart] = wall.split("T");
  const [y, m, day] = datePart.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, day + 1));
  const y2 = next.getUTCFullYear();
  const m2 = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d2 = String(next.getUTCDate()).padStart(2, "0");
  return zonedInputToUtc(`${y2}-${m2}-${d2}T${timePart}`)!;
}

/**
 * Rolls forward any non-done task whose due date's Cairo calendar day is
 * before today's, one day at a time, logging each transition (matches the
 * spec's "28 → 29 → 30 → 1 Oct" example) via the existing audit log
 * (entity "task", action "postponed"). A future-dated task is untouched.
 *
 * Idempotent: once a task's due date lands on today (Cairo), it's no
 * longer "before today" so a re-run (page load, cron, concurrent call) is
 * a no-op for it. The per-task transaction re-checks the condition right
 * before writing, so a race between two concurrent callers can't double-
 * roll the same task.
 */
export async function rolloverOverdueTasks(): Promise<{ rolledTasks: number; totalSteps: number }> {
  const todayYmd = ymdInTz(new Date());

  const candidates = await prisma.task.findMany({
    where: { status: { not: "done" }, dueDate: { lt: new Date() } },
    select: { id: true, dueDate: true },
  });

  let rolledTasks = 0;
  let totalSteps = 0;

  for (const t of candidates) {
    if (!t.dueDate) continue;

    let due = t.dueDate;
    const transitions: { oldDue: Date; newDue: Date }[] = [];
    let steps = 0;
    while (ymdInTz(due) < todayYmd && steps < 3650) {
      const next = addOneCairoDay(due);
      transitions.push({ oldDue: due, newDue: next });
      due = next;
      steps++;
    }
    if (steps === 0) continue;

    const applied = await prisma.$transaction(async (tx) => {
      const fresh = await tx.task.findUnique({
        where: { id: t.id },
        select: { dueDate: true, status: true },
      });
      if (!fresh || fresh.status === "done" || !fresh.dueDate) return false;
      if (ymdInTz(fresh.dueDate) >= todayYmd) return false; // already rolled concurrently

      await tx.task.update({
        where: { id: t.id },
        data: { dueDate: due, postponementCount: { increment: steps } },
      });
      for (const tr of transitions) {
        await writeAuditLog(
          {
            userId: null,
            action: "postponed",
            entity: "task",
            entityId: t.id,
            oldValue: { dueDate: tr.oldDue.toISOString() },
            newValue: { dueDate: tr.newDue.toISOString(), reason: "automatic_rollover" },
          },
          tx,
        );
      }
      return true;
    });

    if (applied) {
      rolledTasks++;
      totalSteps += steps;
    }
  }

  return { rolledTasks, totalSteps };
}
