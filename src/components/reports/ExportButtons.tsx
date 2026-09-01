"use client";

import { useSearchParams } from "next/navigation";

export function ExportButtons({ section = "all" }: { section?: string }) {
  const params = useSearchParams();

  const exportHref = (format: "xlsx" | "csv" | "pdf") => {
    const q = new URLSearchParams(Array.from(params.entries()));
    q.set("format", format);
    q.set("section", section);
    return `/api/export/reports?${q.toString()}`;
  };

  const btn =
    "rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground";

  return (
    <div className="no-print flex flex-wrap gap-2">
      <a href={exportHref("xlsx")} className={btn}>
        تصدير Excel
      </a>
      <a href={exportHref("csv")} className={btn}>
        تصدير CSV
      </a>
      <a href={exportHref("pdf")} className={btn}>
        تصدير PDF
      </a>
    </div>
  );
}
