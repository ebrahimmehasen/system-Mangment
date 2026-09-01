/**
 * Shown only when printing (hidden on screen via `.print-only`).
 * Gives the printed page / saved PDF a proper company header.
 */
export function PrintHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="print-only mb-4 border-b border-black pb-2">
      <div className="text-lg font-bold">404 Legends</div>
      <div className="text-base">{title}</div>
      {subtitle && <div className="text-sm">{subtitle}</div>}
      <div className="text-xs">
        تاريخ الطباعة:{" "}
        {new Intl.DateTimeFormat("ar-EG", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date())}
      </div>
    </div>
  );
}
