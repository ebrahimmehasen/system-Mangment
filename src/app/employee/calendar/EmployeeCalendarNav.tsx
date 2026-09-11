"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { monthParam, shiftMonth } from "@/lib/services/calendar";
import { ymdInTz } from "@/lib/datetime";

export function EmployeeCalendarNav({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const params = useSearchParams();

  function go(mutate: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(Array.from(params.entries()));
    mutate(next);
    next.delete("day");
    router.replace(`/employee/calendar?${next.toString()}`);
  }

  function goMonth(y: number, m: number) {
    go((p) => p.set("month", monthParam(y, m)));
  }

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => goMonth(prev.year, prev.month)}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        الشهر السابق
      </button>
      <button
        type="button"
        onClick={() => go((p) => p.set("month", ymdInTz(new Date()).slice(0, 7)))}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        اليوم
      </button>
      <button
        type="button"
        onClick={() => goMonth(next.year, next.month)}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        الشهر التالي
      </button>
    </div>
  );
}
