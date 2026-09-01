"use client";

import { useState, useTransition } from "react";
import { changeProjectStatusAction } from "@/server/project-actions";

export function StatusChanger({
  projectId,
  current,
  statuses,
}: {
  projectId: string;
  current: string;
  statuses: string[];
}) {
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await changeProjectStatusAction(projectId, next);
      if (res?.error) {
        setValue(prev);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
