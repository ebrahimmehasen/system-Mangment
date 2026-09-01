"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const inputCls =
  "rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-accent focus:outline-none";

export function ProjectsToolbar({
  clients,
  statuses,
}: {
  clients: { id: string; name: string }[];
  statuses: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);

  const push = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(Array.from(params.entries()));
    mutate(next);
    next.delete("page");
    router.replace(`/projects?${next.toString()}`);
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      push((p) => (q ? p.set("q", q) : p.delete("q")));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        className={`${inputCls} sm:w-64`}
        placeholder="بحث باسم المشروع…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        className={inputCls}
        value={params.get("status") ?? ""}
        onChange={(e) =>
          push((p) => (e.target.value ? p.set("status", e.target.value) : p.delete("status")))
        }
      >
        <option value="">كل الحالات</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        className={inputCls}
        value={params.get("client") ?? ""}
        onChange={(e) =>
          push((p) => (e.target.value ? p.set("client", e.target.value) : p.delete("client")))
        }
      >
        <option value="">كل العملاء</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
