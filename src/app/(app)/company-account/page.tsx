import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatEgp, formatOriginalWithEgp } from "@/lib/money";
import { computeCompanyAccountSummary } from "@/lib/services/company-account";
import { CompanyAccountForms } from "./CompanyAccountForms";
import { DeleteEntryButton } from "./DeleteEntryButton";

export default async function CompanyAccountPage() {
  await requireUser();

  const entries = await prisma.companyAccountEntry.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { creator: { select: { name: true, email: true } } },
  });

  const s = computeCompanyAccountSummary(entries);
  const balance = Number(s.balanceEgp);
  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">حساب الشركة</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            محفظة داخلية تُغذّى يدويًا بالإيداعات والسحوبات — منفصلة عن إيرادات
            ومصروفات المشاريع.
          </p>
        </div>
        <CompanyAccountForms />
      </div>

      {/* Balance */}
      <Card>
        <p className="text-sm text-foreground-muted">الرصيد الحالي (بالجنيه المصري)</p>
        <p
          className={`mt-1 text-3xl font-bold ${
            balance >= 0 ? "text-success" : "text-danger"
          }`}
        >
          {formatEgp(s.balanceEgp)}
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <dt className="text-xs text-foreground-muted">إجمالي الإيداعات</dt>
            <dd className="mt-1 font-semibold text-success">
              {formatEgp(s.totalDepositsEgp)}
            </dd>
          </div>
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <dt className="text-xs text-foreground-muted">إجمالي السحوبات</dt>
            <dd className="mt-1 font-semibold text-danger">
              {formatEgp(s.totalWithdrawalsEgp)}
            </dd>
          </div>
        </div>

        {s.byCurrency.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-2 text-xs text-foreground-muted">
              حركة العملات الأجنبية (بالمبلغ الأصلي):
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right text-foreground-muted">
                  <th className="px-3 py-2 font-medium">العملة</th>
                  <th className="px-3 py-2 font-medium">مودع</th>
                  <th className="px-3 py-2 font-medium">مسحوب</th>
                </tr>
              </thead>
              <tbody>
                {s.byCurrency.map((c) => (
                  <tr key={c.currency} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{c.currency}</td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {c.depositsOriginal} {c.currency}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {c.withdrawalsOriginal} {c.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Entries */}
      <Card className="p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold">الحركات ({entries.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
                <th className="px-4 py-3 font-medium">السبب</th>
                <th className="px-4 py-3 font-medium">سجّلها</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-foreground-muted"
                  >
                    لا توجد حركات بعد.
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground-muted">
                    {dateFmt.format(e.date)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={e.direction === "deposit" ? "success" : "danger"}>
                      {e.direction === "deposit" ? "إيداع" : "سحب"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {formatOriginalWithEgp(e.amountOriginal, e.currency, e.amountEgp)}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {e.reason || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {e.creator?.name || e.creator?.email || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <DeleteEntryButton
                      entryId={e.id}
                      label={`${e.direction === "deposit" ? "إيداع" : "سحب"} ${formatEgp(e.amountEgp)}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
