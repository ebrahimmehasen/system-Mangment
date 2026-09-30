"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { shiftYmd } from "@/lib/services/tasks";
import { ymdInTz } from "@/lib/datetime";

const WINDOW_DAYS = 14;
const monthYearFmt = new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" });

export function TaskDateNav({ basePath, from }: { basePath: string; from: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function go(nextFrom: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("from", nextFrom);
    router.push(`${basePath}?${next.toString()}`);
  }

  const today = ymdInTz(new Date());

  // Month/year dropdown: -6..+12 months around today, jumps to day 1 of that month.
  const monthOptions = useMemo(() => {
    const [ty, tm] = today.split("-").map(Number);
    const options: { value: string; label: string }[] = [];
    for (let i = -6; i <= 12; i++) {
      const d = new Date(Date.UTC(ty, tm - 1 + i, 1));
      const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
      options.push({ value, label: monthYearFmt.format(d) });
    }
    return options;
  }, [today]);

  const [fy, fm] = from.split("-");
  const currentMonthValue = `${fy}-${fm}-01`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <select
        value={monthOptions.some((o) => o.value === currentMonthValue) ? currentMonthValue : ""}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
      >
        {!monthOptions.some((o) => o.value === currentMonthValue) && (
          <option value="">{monthYearFmt.format(new Date(`${from}T12:00:00Z`))}</option>
        )}
        {monthOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1 rounded-md border border-border p-1">
        <button
          type="button"
          onClick={() => go(shiftYmd(from, -WINDOW_DAYS))}
          aria-label="الفترة السابقة"
          className="rounded px-2 py-1 text-sm hover:bg-surface-2"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => go(today)}
          className="rounded px-3 py-1 text-sm hover:bg-surface-2"
        >
          اليوم
        </button>
        <button
          type="button"
          onClick={() => go(shiftYmd(from, WINDOW_DAYS))}
          aria-label="الفترة التالية"
          className="rounded px-2 py-1 text-sm hover:bg-surface-2"
        >
          ›
        </button>
      </div>
    </div>
  );
}
