"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/datetime";
import { dismissAlertAction } from "@/server/alert-actions";
import type { Alert } from "@/lib/services/alerts";

const severityTone: Record<Alert["severity"], "danger" | "warning" | "info"> = {
  danger: "danger",
  warning: "warning",
  info: "info",
};
const severityLabel: Record<Alert["severity"], string> = {
  danger: "عاجل",
  warning: "تنبيه",
  info: "معلومة",
};

export function NotificationsList({ alerts }: { alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const visible = alerts.filter((a) => !dismissed.has(a.key));

  function dismiss(key: string) {
    setDismissed((prev) => new Set(prev).add(key));
    startTransition(async () => {
      await dismissAlertAction(key);
    });
  }

  if (visible.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-foreground-muted">
        لا توجد تنبيهات نشطة.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {visible.map((a) => (
        <li key={a.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Badge tone={severityTone[a.severity]}>{severityLabel[a.severity]}</Badge>
            <Link href={a.href} className="text-sm hover:text-accent">
              {a.title}
            </Link>
          </div>
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            {formatDateTime(a.at)}
            <Button variant="ghost" onClick={() => dismiss(a.key)}>
              إخفاء
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
