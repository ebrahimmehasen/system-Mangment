import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TARGET_CLIENT_STATUS_LABELS } from "@/lib/services/target-clients";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  available: "success",
  claimed: "accent",
  won: "success",
  lost: "danger",
  inactive: "neutral",
};

export default async function EmployeeLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "mine" ? "mine" : "available";

  const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: user.id } });

  const leads = await prisma.targetClient.findMany({
    where:
      tab === "mine"
        ? { claimedById: employee.id }
        : { status: "available", hidden: false },
    orderBy: { createdAt: "desc" },
  });

  const tabHref = (t: string) => (t === "available" ? "/employee/leads" : "/employee/leads?tab=mine");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">العملاء المستهدفون</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          اختار عميل متاح واشتغل عليه، أو تابع عملائك الحاليين.
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { key: "available", label: "المتاحين" },
          { key: "mine", label: "عملائي" },
        ].map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`rounded-md border border-border px-3 py-1.5 text-sm ${
              tab === t.key ? "bg-accent/10 text-accent" : "text-foreground-muted hover:bg-surface-2"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">اسم الشركة</th>
                <th className="px-4 py-3 font-medium">حجم الشركة</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-foreground-muted">
                    {tab === "mine" ? "لسه معندكش عملاء مستهدفين." : "لا يوجد عملاء متاحين دلوقتي."}
                  </td>
                </tr>
              )}
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <Link href={`/employee/leads/${l.id}`} className="text-accent hover:underline">
                      {l.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">{l.companySize || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[l.status]}>{TARGET_CLIENT_STATUS_LABELS[l.status]}</Badge>
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
