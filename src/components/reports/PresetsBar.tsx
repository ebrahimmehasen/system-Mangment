"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  savePresetAction,
  deletePresetAction,
  touchPresetAction,
} from "@/server/preset-actions";
import {
  presetFiltersToQuery,
  type PresetFilters,
} from "@/lib/reports/presets";

export interface PresetItem {
  id: string;
  name: string;
  filters: PresetFilters;
}

export function PresetsBar({ presets }: { presets: PresetItem[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();

  const hasFilter = Array.from(sp.keys()).length > 0;

  function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("name", trimmed);
    for (const [k, v] of sp.entries()) fd.set(k, v);
    start(async () => {
      const r = await savePresetAction({}, fd);
      if (r.error) setMsg({ err: r.error });
      else {
        setMsg({ ok: "تم حفظ الإعداد." });
        setName("");
        router.refresh();
      }
    });
  }

  function apply(p: PresetItem) {
    const q = presetFiltersToQuery(p.filters);
    start(async () => {
      void touchPresetAction(p.id);
      router.push(q ? `/reports?${q}` : "/reports");
    });
  }

  function del(p: PresetItem) {
    const fd = new FormData();
    fd.set("id", p.id);
    start(async () => {
      await deletePresetAction({}, fd);
      setMsg({});
      router.refresh();
    });
  }

  const chip =
    "inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs";

  return (
    <div className="no-print flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-foreground-muted">الإعدادات المحفوظة:</span>
        {presets.length === 0 && (
          <span className="text-xs text-foreground-muted">لا يوجد بعد.</span>
        )}
        {presets.map((p) => (
          <span key={p.id} className={chip}>
            <button
              type="button"
              disabled={pending}
              onClick={() => apply(p)}
              className="text-accent hover:underline disabled:opacity-50"
            >
              {p.name}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => del(p)}
              aria-label={`حذف ${p.name}`}
              className="text-foreground-muted hover:text-danger disabled:opacity-50"
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      <form onSubmit={save} className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم لحفظ الفلتر الحالي…"
          maxLength={60}
          className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-md border border-border px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
        >
          حفظ الفلتر الحالي
        </button>
        {!hasFilter && (
          <span className="text-xs text-foreground-muted">
            (لا يوجد فلتر مطبّق — سيُحفظ &quot;كل الفترات&quot;)
          </span>
        )}
        {msg.ok && <span className="text-xs text-success">{msg.ok}</span>}
        {msg.err && <span className="text-xs text-danger">{msg.err}</span>}
      </form>
    </div>
  );
}
