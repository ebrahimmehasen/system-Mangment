import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/datetime";
import {
  coercePresetFilters,
  describeFilters,
  presetFiltersToQuery,
} from "@/lib/reports/presets";
import {
  applyPresetAction,
  deletePresetFormAction,
} from "@/server/preset-actions";

interface ReportLink {
  key: string;
  label: string;
}

const CATEGORIES: { title: string; items: ReportLink[] }[] = [
  {
    title: "تقارير مالية",
    items: [
      { key: "revenue", label: "الإيرادات" },
      { key: "expenses-category", label: "المصروفات" },
      { key: "profit", label: "الأرباح" },
      { key: "outstanding", label: "المستحقات" },
      { key: "clients", label: "التقرير المالي للعملاء" },
      { key: "profitability", label: "ربحية المشاريع" },
    ],
  },
  {
    title: "تقارير مالية متقدمة",
    items: [
      { key: "aging", label: "أعمار الديون" },
      { key: "currency", label: "تقرير العملات" },
      { key: "period-comparison", label: "مقارنة الفترات" },
      { key: "cashflow", label: "بيان التدفق النقدي" },
    ],
  },
  {
    title: "تقارير تشغيلية",
    items: [
      { key: "project-status", label: "حالة المشاريع" },
      { key: "meetings", label: "الاجتماعات" },
      { key: "milestone-completion", label: "إنجاز المراحل" },
      { key: "user-activity", label: "نشاط المستخدمين" },
    ],
  },
  {
    title: "رسوم بيانية",
    items: [{ key: "charts", label: "الرسوم البيانية" }],
  },
];

export default async function ReportsCenterPage() {
  const user = await requireUser();

  const presetRows = await prisma.reportPreset.findMany({
    where: { userId: user.id },
    orderBy: [{ lastUsedAt: "desc" }, { name: "asc" }],
  });
  const presets = presetRows.map((p) => ({
    id: p.id,
    name: p.name,
    lastUsedAt: p.lastUsedAt,
    filters: coercePresetFilters(p.filters),
  }));
  const recent = presets.filter((p) => p.lastUsedAt).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">مركز التقارير</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          كل التقارير في مكان واحد ·{" "}
          <Link href="/reports" className="text-accent hover:underline">
            فتح صفحة التقارير الكاملة
          </Link>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CATEGORIES.map((cat) => (
          <Card key={cat.title}>
            <h2 className="text-base font-semibold">{cat.title}</h2>
            <ul className="mt-3 flex flex-col gap-1.5">
              {cat.items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={`/reports#${item.key}`}
                    className="text-sm text-accent hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {recent.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold">المستخدمة مؤخرًا</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {recent.map((p) => (
              <form key={p.id} action={applyPresetAction}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-accent hover:underline"
                >
                  {p.name}
                </button>
              </form>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-base font-semibold">الإعدادات المحفوظة</h2>
        <p className="mt-1 text-xs text-foreground-muted">
          احفظ فلترًا من صفحة التقارير، ثم طبّقه من هنا.
        </p>
        {presets.length === 0 ? (
          <p className="mt-4 text-sm text-foreground-muted">
            لا توجد إعدادات محفوظة بعد.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right text-foreground-muted">
                  <th className="px-3 py-2 font-medium">الاسم</th>
                  <th className="px-3 py-2 font-medium">الفلتر</th>
                  <th className="px-3 py-2 font-medium">آخر استخدام</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {presets.map((p) => {
                  const qs = presetFiltersToQuery(p.filters);
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <Link
                          href={qs ? `/reports?${qs}` : "/reports"}
                          className="text-accent hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-foreground-muted">
                        {describeFilters(p.filters)}
                      </td>
                      <td className="px-3 py-2 text-foreground-muted whitespace-nowrap">
                        {p.lastUsedAt ? formatDate(p.lastUsedAt) : "—"}
                      </td>
                      <td className="px-3 py-2 text-left">
                        <form action={deletePresetFormAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="text-xs text-foreground-muted hover:text-danger"
                          >
                            حذف
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
