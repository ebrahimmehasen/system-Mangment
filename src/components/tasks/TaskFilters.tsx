"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Project + assignee dropdowns; they write ?project= / ?user= and keep the other params (tab, status, from). */
export function TaskFilters({
  basePath,
  projects,
  people,
}: {
  basePath: string;
  projects: { id: string; name: string }[];
  people: { id: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function set(key: "project" | "user", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const cls =
    "h-9 rounded-md border border-border bg-surface-2 px-2 text-sm text-foreground focus:border-accent focus:outline-none";
  const active = params.get("project") || params.get("user");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="المشروع" className={cls} value={params.get("project") ?? ""} onChange={(e) => set("project", e.target.value)}>
        <option value="">كل المشاريع</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select aria-label="المسؤول" className={cls} value={params.get("user") ?? ""} onChange={(e) => set("user", e.target.value)}>
        <option value="">كل المسؤولين</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {active && (
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.delete("project");
            next.delete("user");
            const qs = next.toString();
            router.push(qs ? `${basePath}?${qs}` : basePath);
          }}
          className="text-xs text-accent hover:underline"
        >
          مسح الفلاتر
        </button>
      )}
    </div>
  );
}
