"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-labels";

const inputCls =
  "rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";

export function AuditLogsToolbar({
  users,
}: {
  users: { id: string; name: string | null; email: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`/audit-logs?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select
        className={inputCls}
        value={params.get("action") ?? ""}
        onChange={(e) => set("action", e.target.value)}
      >
        <option value="">كل العمليات</option>
        {Object.entries(AUDIT_ACTIONS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      <select
        className={inputCls}
        value={params.get("entity") ?? ""}
        onChange={(e) => set("entity", e.target.value)}
      >
        <option value="">كل الأنواع</option>
        {Object.entries(AUDIT_ENTITIES).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      <select
        className={inputCls}
        value={params.get("user") ?? ""}
        onChange={(e) => set("user", e.target.value)}
      >
        <option value="">كل المستخدمين</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name || u.email}
          </option>
        ))}
      </select>

      <label className="flex flex-col text-xs text-foreground-muted">
        من
        <input
          type="date"
          dir="ltr"
          className={inputCls}
          value={params.get("from") ?? ""}
          onChange={(e) => set("from", e.target.value)}
        />
      </label>
      <label className="flex flex-col text-xs text-foreground-muted">
        إلى
        <input
          type="date"
          dir="ltr"
          className={inputCls}
          value={params.get("to") ?? ""}
          onChange={(e) => set("to", e.target.value)}
        />
      </label>

      {Array.from(params.keys()).some((k) => k !== "page") && (
        <button
          type="button"
          onClick={() => router.replace("/audit-logs")}
          className="rounded-md px-3 py-2 text-sm text-foreground-muted hover:text-foreground"
        >
          مسح الفلاتر
        </button>
      )}
    </div>
  );
}
