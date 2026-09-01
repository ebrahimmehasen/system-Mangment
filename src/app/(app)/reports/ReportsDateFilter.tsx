"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PRESETS: { key: string; label: string }[] = [
  { key: "all", label: "كل الفترات" },
  { key: "today", label: "اليوم" },
  { key: "week", label: "هذا الأسبوع" },
  { key: "month", label: "هذا الشهر" },
  { key: "last_month", label: "الشهر الماضي" },
  { key: "year", label: "هذا العام" },
];

const inputCls =
  "rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";

export function ReportsDateFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("range") ?? "all";

  function go(next: URLSearchParams) {
    // reports keep their own sort params; only reset those tied to a table page
    router.replace(`/reports?${next.toString()}`);
  }

  function setPreset(key: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.delete("from");
    next.delete("to");
    if (key === "all") next.delete("range");
    else next.set("range", key);
    go(next);
  }

  function setCustom(field: "from" | "to", value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("range", "custom");
    if (value) next.set(field, value);
    else next.delete(field);
    go(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={`rounded-md border border-border px-3 py-1.5 text-sm ${
              current === p.key
                ? "bg-accent/10 text-accent"
                : "text-foreground-muted hover:bg-surface-2"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-foreground-muted">
          من
          <input
            type="date"
            dir="ltr"
            className={inputCls}
            value={params.get("from") ?? ""}
            onChange={(e) => setCustom("from", e.target.value)}
          />
        </label>
        <label className="flex flex-col text-xs text-foreground-muted">
          إلى
          <input
            type="date"
            dir="ltr"
            className={inputCls}
            value={params.get("to") ?? ""}
            onChange={(e) => setCustom("to", e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
