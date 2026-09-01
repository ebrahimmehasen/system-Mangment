"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartData } from "@/lib/reports/charts";
import {
  ChartCard,
  CHART,
  egpTick,
  egpTooltip,
  tooltipStyle,
} from "./ChartCard";

const shortMonth = (m: string) => m.slice(2).replace("-", "/"); // 2026-01 -> 26/01

export function ReportCharts({ data }: { data: ChartData }) {
  const trendEmpty = !data.monthly.some((m) => m.revenue || m.expense);
  const catEmpty = data.expenseByCategory.length === 0;

  const monthly = data.monthly.map((m) => ({ ...m, label: shortMonth(m.month) }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="اتجاه الإيرادات (آخر 12 شهرًا)" empty={trendEmpty}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={monthly} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} />
            <YAxis tickFormatter={egpTick} tick={{ fill: CHART.axis, fontSize: 11 }} width={40} />
            <Tooltip formatter={(v) => egpTooltip(v as number)} {...tooltipStyle} />
            <Line
              type="monotone"
              dataKey="revenue"
              name="الإيرادات"
              stroke={CHART.success}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="التدفق النقدي (إيراد مقابل مصروف)" empty={trendEmpty}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} />
            <YAxis tickFormatter={egpTick} tick={{ fill: CHART.axis, fontSize: 11 }} width={40} />
            <Tooltip formatter={(v) => egpTooltip(v as number)} {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenue" name="إيراد" fill={CHART.success} radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="مصروف" fill={CHART.danger} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="صافي الربح الشهري" empty={trendEmpty}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} />
            <YAxis tickFormatter={egpTick} tick={{ fill: CHART.axis, fontSize: 11 }} width={40} />
            <Tooltip formatter={(v) => egpTooltip(v as number)} {...tooltipStyle} />
            <Bar dataKey="profit" name="صافي الربح" radius={[3, 3, 0, 0]}>
              {monthly.map((m, i) => (
                <Cell key={i} fill={m.profit >= 0 ? CHART.accent : CHART.danger} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={`توزيع المصروفات حسب التصنيف — ${data.rangeLabel}`} empty={catEmpty}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.expenseByCategory}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.expenseByCategory.map((_, i) => (
                <Cell key={i} fill={CHART.categorical[i % CHART.categorical.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => egpTooltip(v as number)} {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
