"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { dismissAlertAction } from "@/server/alert-actions";
import type { Alert } from "@/lib/services/alerts";

const severityDot: Record<Alert["severity"], string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
};

export function NotificationBell({ alerts }: { alerts: Alert[] }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const visible = alerts.filter((a) => !dismissed.has(a.key));

  function dismiss(key: string) {
    setDismissed((prev) => new Set(prev).add(key));
    startTransition(async () => {
      await dismissAlertAction(key);
    });
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="التنبيهات"
        className="relative rounded-md p-2 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {visible.length > 0 && (
          <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {visible.length > 9 ? "9+" : visible.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-2 max-h-96 w-80 overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">التنبيهات</span>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-accent hover:underline"
            >
              عرض الكل
            </Link>
          </div>
          {visible.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-foreground-muted">
              لا توجد تنبيهات.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {visible.slice(0, 8).map((a) => (
                <li key={a.key} className="flex items-start gap-2 px-3 py-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${severityDot[a.severity]}`} />
                  <Link
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className="min-w-0 flex-1 text-sm hover:text-accent"
                  >
                    {a.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => dismiss(a.key)}
                    aria-label="إخفاء"
                    className="text-xs text-foreground-muted hover:text-foreground"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
