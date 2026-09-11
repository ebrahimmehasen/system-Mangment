import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatEgp, formatOriginalWithEgp } from "@/lib/money";
import { computeEmployeePayrollSummary, PAY_TYPE_LABELS } from "@/lib/services/payroll";
import { updateEmployeeAction } from "@/server/employee-actions";
import { EmployeeFormModal } from "../EmployeeFormModal";
import { DeleteEmployeeButton } from "./DeleteEmployeeButton";
import { CvSection } from "./CvSection";
import { RatingControl } from "./RatingControl";
import { EmployeePaymentModal } from "./EmployeePaymentModal";
import { DeletePaymentButton } from "./DeletePaymentButton";
import { CreateEmployeeLoginModal } from "./CreateEmployeeLoginModal";

type PayType = keyof typeof PAY_TYPE_LABELS;

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [employee, projects] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: {
        user: { select: { email: true } },
        assignments: {
          orderBy: { assignedAt: "desc" },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                client: { select: { name: true } },
              },
            },
          },
        },
        payments: {
          orderBy: { date: "desc" },
          include: {
            project: { select: { name: true, client: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!employee) notFound();

  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });
  const updateAction = updateEmployeeAction.bind(null, employee.id);
  const payroll = computeEmployeePayrollSummary(employee.payments);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/employees" className="text-sm text-accent hover:underline">
              الموظفون
            </Link>
            <span className="text-foreground-muted">/</span>
            <h1 className="text-xl font-semibold">{employee.name}</h1>
            <Badge tone={employee.status === "active" ? "success" : "neutral"}>
              {employee.status === "active" ? "نشط" : "مؤرشف"}
            </Badge>
          </div>
          {employee.qualification && (
            <p className="mt-1 text-sm text-foreground-muted">
              {employee.qualification}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/export/employees/${employee.id}`}
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            تصدير تقرير PDF
          </a>
          <EmployeeFormModal
            mode="edit"
            action={updateAction}
            employee={{
              name: employee.name,
              age: employee.age,
              country: employee.country,
              governorate: employee.governorate,
              phone: employee.phone,
              qualification: employee.qualification,
              notes: employee.notes,
              status: employee.status,
              cvFileName: employee.cvFileName,
            }}
            triggerLabel="تعديل"
            triggerVariant="secondary"
          />
          <DeleteEmployeeButton
            employeeId={employee.id}
            employeeName={employee.name}
          />
        </div>
      </div>

      {/* Basic information */}
      <Card>
        <h2 className="mb-4 text-base font-semibold">المعلومات الأساسية</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Info label="المؤهل / الوظيفة" value={employee.qualification} />
          <Info
            label="العمر"
            value={employee.age != null ? String(employee.age) : null}
            ltr
          />
          <Info label="الدولة" value={employee.country} />
          <Info label="المحافظة" value={employee.governorate} />
          <Info label="الهاتف" value={employee.phone} ltr />
          <Info label="أُضيف في" value={dateFmt.format(employee.createdAt)} />
          <Info label="ملاحظات" value={employee.notes} />
        </dl>
      </Card>

      {/* Portal login */}
      <Card>
        <h2 className="mb-1 text-base font-semibold">حساب الدخول (بوابة الموظف)</h2>
        {employee.user ? (
          <>
            <p className="mb-1 text-sm text-foreground-muted">
              للموظف حساب دخول فعّال.
            </p>
            <p dir="ltr" className="text-sm text-foreground">
              {employee.user.email}
            </p>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-foreground-muted">
              الموظف لسه معندوش حساب دخول لبوابة الموظفين.
            </p>
            <CreateEmployeeLoginModal employeeId={employee.id} />
          </>
        )}
      </Card>

      {/* Assigned projects */}
      <Card className="p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold">
            المشاريع المعيّن عليها ({employee.assignments.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">المشروع</th>
                <th className="px-4 py-3 font-medium">العميل</th>
                <th className="px-4 py-3 font-medium">الدور</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">تاريخ التعيين</th>
              </tr>
            </thead>
            <tbody>
              {employee.assignments.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-foreground-muted"
                  >
                    غير معيّن على أي مشروع.
                  </td>
                </tr>
              )}
              {employee.assignments.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${a.project.id}`}
                      className="text-accent hover:underline"
                    >
                      {a.project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {a.project.client.name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={a.role === "supervisor" ? "accent" : "neutral"}>
                      {a.role === "supervisor" ? "مشرف" : "موظف"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {a.project.status}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {dateFmt.format(a.assignedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payments */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
          <h2 className="text-base font-semibold">
            المدفوعات ({employee.payments.length})
          </h2>
          <EmployeePaymentModal employeeId={employee.id} projects={projects} />
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <dt className="text-xs text-foreground-muted">إجمالي المصروف (عمولة + راتب + مكافأة)</dt>
            <dd className="mt-1 font-semibold text-success">
              {formatEgp(payroll.disbursed)}
            </dd>
          </div>
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <dt className="text-xs text-foreground-muted">إجمالي الخصومات</dt>
            <dd className="mt-1 font-semibold text-danger">
              {formatEgp(payroll.deducted)}
            </dd>
          </div>
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <dt className="text-xs text-foreground-muted">الصافي المستلَم</dt>
            <dd className="mt-1 font-semibold">{formatEgp(payroll.net)}</dd>
          </div>
        </div>

        {payroll.byProject.length > 0 && (
          <div className="overflow-x-auto px-4 pb-4">
            <p className="mb-2 text-xs text-foreground-muted">حسب المشروع:</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right text-foreground-muted">
                  <th className="px-3 py-2 font-medium">المشروع</th>
                  <th className="px-3 py-2 font-medium">مصروف</th>
                  <th className="px-3 py-2 font-medium">مخصوم</th>
                  <th className="px-3 py-2 font-medium">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {payroll.byProject.map((r) => (
                  <tr key={r.projectId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{r.projectName}</td>
                    <td className="px-3 py-2 text-foreground-muted">{formatEgp(r.disbursed)}</td>
                    <td className="px-3 py-2 text-foreground-muted">{formatEgp(r.deducted)}</td>
                    <td className="px-3 py-2">{formatEgp(r.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">المشروع</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
                <th className="px-4 py-3 font-medium">ملاحظات</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {employee.payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">
                    لا توجد مدفوعات بعد.
                  </td>
                </tr>
              )}
              {employee.payments.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground-muted">
                    {dateFmt.format(p.date)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={p.payType === "deduction" ? "danger" : "success"}>
                      {PAY_TYPE_LABELS[p.payType as PayType]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {p.project.name}
                  </td>
                  <td className="px-4 py-3">
                    {formatOriginalWithEgp(p.amountOriginal, p.currency, p.amountEgp)}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">{p.notes || "—"}</td>
                  <td className="px-4 py-3">
                    <DeletePaymentButton
                      paymentId={p.id}
                      label={`${PAY_TYPE_LABELS[p.payType as PayType]} ${formatEgp(p.amountEgp)}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Rating */}
      <Card>
        <h2 className="mb-1 text-base font-semibold">التقييم</h2>
        <p className="mb-4 text-xs text-foreground-muted">
          تقييم يدوي من 1 إلى 10 يحدّده المشرف.
        </p>
        <RatingControl employeeId={employee.id} rating={employee.rating ?? 0} />
      </Card>

      {/* CV */}
      <Card>
        <h2 className="mb-4 text-base font-semibold">السيرة الذاتية</h2>
        <CvSection employeeId={employee.id} cvFileName={employee.cvFileName} />
      </Card>
    </div>
  );
}

function Info({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string | null;
  ltr?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd dir={ltr ? "ltr" : undefined} className={ltr ? "mt-0.5 text-right" : "mt-0.5"}>
        {value || "—"}
      </dd>
    </div>
  );
}
