import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { formatEgp, formatCurrency } from "@/lib/money";
import { getReportsData, type ReportsParams } from "@/lib/reports/data";
import { getChartData } from "@/lib/reports/charts";
import { getAdvancedFinancials } from "@/lib/reports/advanced";
import { ReportsDateFilter } from "./ReportsDateFilter";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { PrintHeader } from "@/components/reports/PrintHeader";
import { ReportCharts } from "@/components/charts/ReportCharts";

type SP = Record<string, string | undefined>;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireUser();
  const sp = (await searchParams) as ReportsParams & SP;
  const [d, chartData, adv] = await Promise.all([
    getReportsData(sp),
    getChartData(sp),
    getAdvancedFinancials(sp),
  ]);

  const sortLink = (
    sortKey: "csort" | "psort",
    dirKey: "cdir" | "pdir",
    field: string,
    label: string,
  ) => {
    const active = sp[sortKey] === field;
    const nextDir = active && sp[dirKey] === "desc" ? "asc" : "desc";
    const params = new URLSearchParams(
      Object.entries(sp).filter(([, v]) => v) as [string, string][],
    );
    params.set(sortKey, field);
    params.set(dirKey, nextDir);
    return (
      <Link href={`/reports?${params.toString()}`} className="hover:text-accent">
        {label} {active ? (sp[dirKey] === "asc" ? "▲" : "▼") : ""}
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PrintHeader title="التقارير" subtitle={`الفترة: ${d.range.label}`} />

      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">التقارير</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            الفترة: {d.range.label}
          </p>
        </div>
        <ExportButtons />
      </div>

      <Card className="no-print">
        <ReportsDateFilter />
      </Card>

      {/* Charts */}
      <section className="flex flex-col gap-3 break-inside-avoid">
        <h2 className="text-sm font-semibold text-foreground-muted">رسوم بيانية</h2>
        <ReportCharts data={chartData} />
      </section>

      {/* 1. Revenue */}
      <Section title={`تقرير الإيرادات — ${formatEgp(d.revenueTotal)}`} section="revenue">
        <SimpleTable
          head={["الشهر", "الإيرادات"]}
          rows={d.revenue.map((r) => [r.month, formatEgp(r.total)])}
          empty="لا توجد إيرادات في هذه الفترة."
        />
      </Section>

      {/* 2. Expenses */}
      <Section title="تقرير المصروفات" section="expenses-category">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm text-foreground-muted">حسب النوع</h3>
            <SimpleTable
              head={["النوع", "الإجمالي"]}
              rows={[
                ["مصروفات مشاريع", formatEgp(d.projectExpenseTotal)],
                ["مصروفات شركة", formatEgp(d.companyExpenseTotal)],
              ]}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm text-foreground-muted">حسب التصنيف</h3>
            <SimpleTable
              head={["التصنيف", "الإجمالي"]}
              rows={d.expenseByCategory.map((c) => [c.category, formatEgp(c.total)])}
              empty="لا توجد مصروفات في هذه الفترة."
            />
          </div>
        </div>
      </Section>

      {/* 3. Profit */}
      <Section title="تقرير الأرباح (خلال الفترة)" section="profit">
        <SimpleTable
          head={["المشروع", "العميل", "الإيرادات", "المصروفات", "الربح"]}
          rows={d.profitRows.map((r) => [
            r.name,
            r.client,
            formatEgp(r.revenue),
            formatEgp(r.expenses),
            formatEgp(r.profit),
          ])}
          empty="لا توجد حركة في هذه الفترة."
        />
        <p className="mt-3 text-sm">
          صافي الشركة (الإيرادات − كل المصروفات):{" "}
          <span className={Number(d.companyNet) >= 0 ? "text-success" : "text-danger"}>
            {formatEgp(d.companyNet)}
          </span>
        </p>
      </Section>

      {/* 4. Outstanding */}
      <Section
        title={`تقرير المستحقات — ${formatEgp(d.outstandingTotal)}`}
        note="لقطة حالية (لا تتأثر بالفلتر الزمني)."
        section="outstanding"
      >
        <SimpleTable
          head={["العميل", "المشروع", "القيمة النهائية", "المدفوع", "المتبقي"]}
          rows={d.outstanding.map((r) => [
            r.clientName,
            r.name,
            formatEgp(r.finalContractValue),
            formatEgp(r.paid),
            formatEgp(r.remaining),
          ])}
          empty="لا توجد مستحقات."
        />
      </Section>

      {/* 5. Client financial */}
      <Section title="التقرير المالي للعملاء" note="لقطة حالية." section="clients">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "name", "العميل")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "projectCount", "مشاريع")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "finalValue", "القيمة النهائية")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "paid", "المدفوع")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "remaining", "المتبقي")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "expenses", "المصروفات")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "profit", "الربح")}</th>
              </tr>
            </thead>
            <tbody>
              {d.clientRows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-foreground-muted">لا يوجد عملاء.</td></tr>
              )}
              {d.clientRows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/clients/${r.id}`} className="text-accent hover:underline">{r.name}</Link>
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">{r.projectCount}</td>
                  <td className="px-3 py-2">{formatEgp(r.finalValue)}</td>
                  <td className="px-3 py-2">{formatEgp(r.paid)}</td>
                  <td className="px-3 py-2">{formatEgp(r.remaining)}</td>
                  <td className="px-3 py-2">{formatEgp(r.expenses)}</td>
                  <td className="px-3 py-2">{formatEgp(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 6. Project profitability */}
      <Section title="تقرير ربحية المشاريع" note="لقطة حالية." section="profitability">
        <form className="no-print mb-3">
          {Object.entries(sp)
            .filter(([k, v]) => v && k !== "pq")
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v as string} />
            ))}
          <input
            name="pq"
            defaultValue={sp.pq ?? ""}
            placeholder="بحث باسم المشروع…"
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "name", "المشروع")}</th>
                <th className="px-3 py-2 font-medium">العميل</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "contractValue", "قيمة العقد")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "finalContractValue", "النهائية")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "paid", "المدفوع")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "expenses", "المصروفات")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "remaining", "المتبقي")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "profit", "الربح")}</th>
              </tr>
            </thead>
            <tbody>
              {d.profitability.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-foreground-muted">لا توجد مشاريع.</td></tr>
              )}
              {d.profitability.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/projects/${r.id}`} className="text-accent hover:underline">{r.name}</Link>
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">{r.clientName}</td>
                  <td className="px-3 py-2">{formatEgp(r.contractValue)}</td>
                  <td className="px-3 py-2">{formatEgp(r.finalContractValue)}</td>
                  <td className="px-3 py-2">{formatEgp(r.paid)}</td>
                  <td className="px-3 py-2">{formatEgp(r.expenses)}</td>
                  <td className="px-3 py-2">{formatEgp(r.remaining)}</td>
                  <td className="px-3 py-2">{formatEgp(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <h2 className="mt-2 text-sm font-semibold text-foreground-muted">
        تقارير مالية متقدمة
      </h2>

      {/* 7. Receivables aging */}
      <Section
        title={`أعمار الديون — ${formatEgp(adv.aging.total)}`}
        note="لقطة حالية. عمر الدين يُحتسب من تاريخ التسليم الفعلي، وإلا المتوقع، وإلا البدء، وإلا الإنشاء."
        section="aging"
      >
        <SimpleTable
          head={["الفئة", "عدد المشاريع", "الإجمالي"]}
          rows={adv.aging.buckets.map((b) => [
            b.label,
            b.count,
            formatEgp(b.total),
          ])}
        />
        {adv.aging.rows.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm text-foreground-muted">تفصيل المشاريع</h3>
            <SimpleTable
              head={["المشروع", "العميل", "المتبقي", "عمر الدين", "الفئة"]}
              rows={adv.aging.rows.map((r) => [
                r.projectName,
                r.clientName,
                formatEgp(r.remaining),
                `${r.ageDays} يوم`,
                r.bucket === "b0"
                  ? "٠–٣٠"
                  : r.bucket === "b30"
                    ? "٣١–٦٠"
                    : r.bucket === "b60"
                      ? "٦١–٩٠"
                      : "+٩٠",
              ])}
            />
          </div>
        )}
        {adv.aging.rows.length === 0 && (
          <p className="mt-3 text-sm text-foreground-muted">لا توجد مستحقات.</p>
        )}
      </Section>

      {/* 8. Currency report */}
      <Section
        title="تقرير العملات"
        note="المحصّل والمنصرف حسب العملة الأصلية (يتأثر بالفلتر الزمني)."
        section="currency"
      >
        <SimpleTable
          head={[
            "العملة",
            "محصّل (بالعملة)",
            "محصّل (ج.م)",
            "منصرف (بالعملة)",
            "منصرف (ج.م)",
            "الصافي (ج.م)",
          ]}
          rows={adv.currency.rows.map((r) => [
            r.currency,
            formatCurrency(r.receivedOriginal, r.currency),
            formatEgp(r.receivedEgp),
            formatCurrency(r.spentOriginal, r.currency),
            formatEgp(r.spentEgp),
            formatEgp(r.netEgp),
          ])}
          empty="لا توجد حركة مالية في هذه الفترة."
        />
      </Section>

      {/* 9. Period comparison */}
      <Section
        title="مقارنة الفترات"
        note="الشهر الحالي مقابل الشهر السابق ونفس الشهر من العام السابق (لا يتأثر بالفلتر)."
        section="period-comparison"
      >
        <SimpleTable
          head={[
            "البند",
            adv.comparison.current.label,
            adv.comparison.previous.label,
            adv.comparison.yearAgo.label,
            "▲ عن الشهر السابق",
            "▲ عن العام السابق",
          ]}
          rows={[
            [
              "الإيرادات",
              formatEgp(adv.comparison.current.revenue),
              formatEgp(adv.comparison.previous.revenue),
              formatEgp(adv.comparison.yearAgo.revenue),
              fmtPct(adv.comparison.mom.revenue),
              fmtPct(adv.comparison.yoy.revenue),
            ],
            [
              "المصروفات",
              formatEgp(adv.comparison.current.expense),
              formatEgp(adv.comparison.previous.expense),
              formatEgp(adv.comparison.yearAgo.expense),
              fmtPct(adv.comparison.mom.expense),
              fmtPct(adv.comparison.yoy.expense),
            ],
            [
              "الصافي",
              formatEgp(adv.comparison.current.net),
              formatEgp(adv.comparison.previous.net),
              formatEgp(adv.comparison.yearAgo.net),
              fmtPct(adv.comparison.mom.net),
              fmtPct(adv.comparison.yoy.net),
            ],
          ]}
        />
      </Section>

      {/* 10. Cash flow statement */}
      <Section
        title={`بيان التدفق النقدي — الرصيد ${formatEgp(adv.cashflow.closing)}`}
        note="آخر ١٢ شهرًا. الرصيد التراكمي يشمل كل الحركة قبل الفترة (لا يتأثر بالفلتر)."
        section="cashflow"
      >
        <SimpleTable
          head={["الشهر", "داخل", "خارج", "الصافي", "الرصيد التراكمي"]}
          rows={[
            ["رصيد افتتاحي", "—", "—", "—", formatEgp(adv.cashflow.opening)],
            ...adv.cashflow.rows.map((r) => [
              r.month.slice(2).replace("-", "/"),
              formatEgp(r.inflow),
              formatEgp(r.outflow),
              formatEgp(r.net),
              formatEgp(r.balance),
            ]),
            [
              "الإجمالي",
              formatEgp(adv.cashflow.totalIn),
              formatEgp(adv.cashflow.totalOut),
              formatEgp(adv.cashflow.totalNet),
              formatEgp(adv.cashflow.closing),
            ],
          ]}
        />
      </Section>
    </div>
  );
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "▲ +" : "▼ "}${v.toFixed(1)}%`;
}

function Section({
  title,
  note,
  section,
  children,
}: {
  title: string;
  note?: string;
  section?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {note && <p className="mt-1 text-xs text-foreground-muted">{note}</p>}
        </div>
        {section && <ExportButtons section={section} />}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function SimpleTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: (string | number)[][];
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-right text-foreground-muted">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty && (
            <tr>
              <td colSpan={head.length} className="px-3 py-6 text-center text-foreground-muted">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
