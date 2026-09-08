"use client";

import { useSearchParams } from "next/navigation";

export function ExportEmployeesButton() {
  const params = useSearchParams();

  const q = new URLSearchParams();
  const search = params.get("q");
  const status = params.get("status");
  if (search) q.set("q", search);
  if (status) q.set("status", status);
  const href = `/api/export/employees${q.toString() ? `?${q}` : ""}`;

  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
    >
      تصدير Excel
    </a>
  );
}
