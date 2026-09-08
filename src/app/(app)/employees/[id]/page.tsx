import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { updateEmployeeAction } from "@/server/employee-actions";
import { EmployeeFormModal } from "../EmployeeFormModal";
import { DeleteEmployeeButton } from "./DeleteEmployeeButton";
import { CvSection } from "./CvSection";
import { RatingControl } from "./RatingControl";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      _count: { select: { payments: true } },
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
    },
  });
  if (!employee) notFound();

  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });
  const updateAction = updateEmployeeAction.bind(null, employee.id);

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
        <div className="flex gap-2">
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
