"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { shiftYmd } from "@/lib/services/tasks";
import { ymdInTz } from "@/lib/datetime";

const WINDOW_DAYS = 14;

export function TaskDateNav({ basePath, from }: { basePath: string; from: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function go(nextFrom: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("from", nextFrom);
    router.push(`${basePath}?${next.toString()}`);
  }

  const today = ymdInTz(new Date());

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => go(shiftYmd(from, -WINDOW_DAYS))}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        السابق
      </button>
      <button
        type="button"
        onClick={() => go(today)}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        اليوم
      </button>
      <button
        type="button"
        onClick={() => go(shiftYmd(from, WINDOW_DAYS))}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        التالي
      </button>
      <input
        type="date"
        dir="ltr"
        defaultValue={from}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
      />
    </div>
  );
}
