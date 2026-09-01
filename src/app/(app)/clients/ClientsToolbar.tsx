"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function ClientsToolbar() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const status = params.get("status") ?? "";
  const first = useRef(true);

  // debounce search -> URL
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(Array.from(params.entries()));
      if (q) next.set("q", q);
      else next.delete("q");
      next.delete("page");
      router.replace(`/clients?${next.toString()}`);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setStatus(value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value) next.set("status", value);
    else next.delete("status");
    next.delete("page");
    router.replace(`/clients?${next.toString()}`);
  }

  const inputCls =
    "rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-accent focus:outline-none";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        className={`${inputCls} sm:w-64`}
        placeholder="بحث بالاسم أو الشركة أو الهاتف أو البريد…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        className={inputCls}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="">كل الحالات</option>
        <option value="active">نشط</option>
        <option value="inactive">غير نشط</option>
      </select>
    </div>
  );
}
