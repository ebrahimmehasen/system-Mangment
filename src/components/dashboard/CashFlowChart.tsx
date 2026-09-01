"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { MonthlyPoint } from "@/lib/reports/charts";
import { CHART, egpTick, egpTooltip, tooltipStyle } from "@/components/charts/ChartCard";

const shortMonth = (m: string) => m.slice(2).replace("-", "/");

export function CashFlowChart({ monthly }: { monthly: MonthlyPoint[] }) {
  const data = monthly.map((m) => ({ ...m, label: shortMonth(m.month) }));
  const empty = !data.some((m) => m.revenue || m.expense);

  if (empty) {
    return (
      <p className="py-10 text-center text-xs text-foreground-muted">
        لا توجد بيانات كافية لعرض الرسم.
      </p>
    );
  }

  return (
    <div className="h-56 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} />
          <YAxis tickFormatter={egpTick} tick={{ fill: CHART.axis, fontSize: 11 }} width={40} />
          <Tooltip formatter={(v) => egpTooltip(v as number)} {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenue" name="إيراد" fill={CHART.success} radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" name="مصروف" fill={CHART.danger} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
