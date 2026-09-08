import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { createEmployeeAction } from "@/server/employee-actions";
import { EmployeeFormModal } from "./EmployeeFormModal";
import { EmployeesToolbar } from "./EmployeesToolbar";

const PAGE_SIZE = 10;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const status =
    sp.status === "active" || sp.status === "inactive" ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.EmployeeWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { qualification: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { governorate: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { assignments: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/employees?${qs}` : "/employees";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">الموظفون</h1>
          <p className="mt-1 text-sm text-foreground-muted">{total} موظف</p>
        </div>
        <EmployeeFormModal
          mode="create"
          action={createEmployeeAction}
          triggerLabel="+ موظف جديد"
        />
      </div>

      <EmployeesToolbar />

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">المؤهل / الوظيفة</th>
                <th className="px-4 py-3 font-medium">الدولة</th>
                <th className="px-4 py-3 font-medium">المحافظة</th>
                <th className="px-4 py-3 font-medium">الهاتف</th>
                <th className="px-4 py-3 font-medium">المشاريع</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-foreground-muted"
                  >
                    {q || status
                      ? "لا توجد نتائج مطابقة."
                      : "لا يوجد موظفون بعد. ابدأ بإضافة موظف جديد."}
                  </td>
                </tr>
              )}
              {employees.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-0 hover:bg-surface-2/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/employees/${e.id}`}
                      className="text-accent hover:underline"
                    >
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {e.qualification || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {e.country || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {e.governorate || "—"}
                  </td>
                  <td
                    dir="ltr"
                    className="px-4 py-3 text-right text-foreground-muted"
                  >
                    {e.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {e._count.assignments}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={e.status === "active" ? "success" : "neutral"}>
                      {e.status === "active" ? "نشط" : "مؤرشف"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination page={page} totalPages={totalPages} makeHref={makeHref} />
    </div>
  );
}
