"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { monthParam, shiftMonth } from "@/lib/services/calendar";
import { ymdInTz } from "@/lib/datetime";

const TYPES: { key: string; label: string }[] = [
  { key: "meeting", label: "اجتماعات" },
  { key: "milestone", label: "مراحل المشاريع" },
  { key: "reminder", label: "تذكيرات" },
  { key: "delivery", label: "تسليم المشاريع" },
];

export function CalendarNav({
  year,
  month,
  projects,
}: {
  year: number;
  month: number;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const activeTypes = new Set(
    (params.get("types") ?? "meeting,milestone,reminder,delivery").split(","),
  );

  function go(mutate: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(Array.from(params.entries()));
    mutate(next);
    next.delete("day");
    router.replace(`/calendar?${next.toString()}`);
  }

  function goMonth(y: number, m: number) {
    go((p) => p.set("month", monthParam(y, m)));
  }

  function toggleType(key: string) {
    go((p) => {
      const set = new Set(activeTypes);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      const all = TYPES.map((t) => t.key);
      if (set.size === 0 || set.size === all.length) p.delete("types");
      else p.set("types", Array.from(set).join(","));
    });
  }

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div className="flex flex-col gap-3">
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

        <select
          className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
          value={params.get("project") ?? ""}
          onChange={(e) =>
            go((p) =>
              e.target.value ? p.set("project", e.target.value) : p.delete("project"),
            )
          }
        >
          <option value="">كل المشاريع</option>
          {projects.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => toggleType(t.key)}
            className={`rounded-md border border-border px-3 py-1 text-xs ${
              activeTypes.has(t.key)
                ? "bg-accent/10 text-accent"
                : "text-foreground-muted hover:bg-surface-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
