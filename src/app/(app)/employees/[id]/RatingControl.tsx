"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { setEmployeeRatingAction } from "@/server/employee-actions";

const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function RatingControl({
  employeeId,
  rating,
}: {
  employeeId: string;
  rating: number;
}) {
  const [value, setValue] = useState(rating);
  const [hover, setHover] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = hover ?? value;

  function set(next: number) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await setEmployeeRatingAction(employeeId, next);
      if (res?.error) {
        setValue(prev);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex gap-1"
          onMouseLeave={() => setHover(null)}
          role="radiogroup"
          aria-label="تقييم الموظف من 1 إلى 10"
        >
          {SCALE.map((n) => (
            <button
              key={n}
              type="button"
              disabled={pending}
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} من 10`}
              onMouseEnter={() => setHover(n)}
              onClick={() => set(n)}
              className={cn(
                "h-8 w-8 rounded-md border text-sm font-medium transition-colors disabled:opacity-50",
                n <= shown
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-surface-2 text-foreground-muted hover:border-accent",
              )}
            >
              {n}
            </button>
          ))}
        </div>

        <span className="text-sm text-foreground-muted">
          {value > 0 ? `${value} / 10` : "غير مقيّم"}
        </span>

        {value > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() => set(0)}
            className="text-xs text-foreground-muted hover:text-danger disabled:opacity-50"
          >
            مسح التقييم
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
