import { Card } from "@/components/ui/Card";

/** Theme-matched chart palette (dark). */
export const CHART = {
  accent: "#6366f1",
  success: "#22c55e",
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#38bdf8",
  grid: "#26262b",
  axis: "#a1a1aa",
  categorical: ["#6366f1", "#38bdf8", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa", "#f472b6", "#2dd4bf", "#fb923c", "#94a3b8"],
};

export const egpTick = (v: number) => {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
};

const egpFmt = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 });
export const egpTooltip = (v: number | string) => `${egpFmt.format(Number(v))} ج.م`;

export const tooltipStyle = {
  contentStyle: {
    background: "#111114",
    border: "1px solid #26262b",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#ededed" },
  itemStyle: { color: "#ededed" },
};

export function ChartCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="break-inside-avoid">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {empty ? (
        <p className="py-10 text-center text-xs text-foreground-muted">
          لا توجد بيانات كافية لعرض الرسم.
        </p>
      ) : (
        <div className="h-64 w-full" dir="ltr">
          {children}
        </div>
      )}
    </Card>
  );
}
