"use client";

import { useState } from "react";
import { TASK_PRIORITY_MAX } from "@/lib/services/tasks";
import { priorityTone } from "./TaskPriorityBadge";

const PRESETS = [
  { label: "عاجلة", value: 1 },
  { label: "عالية", value: 10 },
  { label: "متوسطة", value: 30 },
  { label: "منخفضة", value: 70 },
];

/** Form field (name="priority"): quick presets + exact number. 1 = most important … 99 = least; blank = none. */
export function TaskPriorityField({ defaultValue = 0, error }: { defaultValue?: number; error?: string }) {
  const [value, setValue] = useState(defaultValue > 0 ? String(defaultValue) : "");
  const current = Number(value);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="task-priority" className="text-sm text-foreground-muted">
        الأولوية (1 = الأهم … {TASK_PRIORITY_MAX} = الأقل)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const active = current === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setValue(active ? "" : String(p.value))}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active ? priorityTone(p.value).cls : "border-border text-foreground-muted hover:bg-surface-2"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <input
          id="task-priority"
          name="priority"
          type="number"
          inputMode="numeric"
          min={1}
          max={TASK_PRIORITY_MAX}
          dir="ltr"
          placeholder="—"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-16 rounded-md border border-border bg-surface-2 px-2 text-center text-sm tabular-nums focus:border-accent focus:outline-none"
        />
        {value && (
          <button type="button" onClick={() => setValue("")} className="text-xs text-foreground-muted hover:underline">
            مسح
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
