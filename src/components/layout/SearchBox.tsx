"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Hit {
  id: string;
  name: string;
  sub: string;
}

export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ clients: Hit[]; projects: Hit[] }>({
    clients: [],
    projects: [],
  });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) setResults(await res.json());
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  function goTo(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const hasResults = results.clients.length > 0 || results.projects.length > 0;

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="بحث عن عميل أو مشروع…"
        className="w-full rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-accent focus:outline-none"
      />

      {open && q.trim().length >= 2 && (
        <div className="absolute right-0 z-40 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-xs text-foreground-muted">جارٍ البحث…</div>
          )}
          {!loading && !hasResults && (
            <div className="px-3 py-3 text-xs text-foreground-muted">لا توجد نتائج.</div>
          )}
          {results.clients.length > 0 && (
            <div>
              <div className="bg-surface-2 px-3 py-1 text-xs text-foreground-muted">العملاء</div>
              {results.clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => goTo(`/clients/${c.id}`)}
                  className="block w-full px-3 py-2 text-right text-sm hover:bg-surface-2"
                >
                  {c.name}
                  {c.sub && <span className="mr-2 text-xs text-foreground-muted">{c.sub}</span>}
                </button>
              ))}
            </div>
          )}
          {results.projects.length > 0 && (
            <div>
              <div className="bg-surface-2 px-3 py-1 text-xs text-foreground-muted">المشاريع</div>
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goTo(`/projects/${p.id}`)}
                  className="block w-full px-3 py-2 text-right text-sm hover:bg-surface-2"
                >
                  {p.name}
                  {p.sub && <span className="mr-2 text-xs text-foreground-muted">{p.sub}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
