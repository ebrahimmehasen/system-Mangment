import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ClientSubmissionForm } from "./ClientSubmissionForm";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
};
const STATUS_TONE: Record<string, "neutral" | "success" | "danger"> = {
  pending: "neutral",
  approved: "success",
  rejected: "danger",
};

export default async function EmployeeClientSubmissionsPage() {
  const user = await requireUser();
  const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: user.id } });

  const submissions = await prisma.clientSubmission.findMany({
    where: { submittedById: employee.id },
    orderBy: { createdAt: "desc" },
  });

  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">إضافة عميل جديد</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          ابعت بيانات عميل حقيقي وقع معاكم — الطلب مش هيتفعّل غير بعد موافقة الأدمن.
        </p>
      </div>

      <Card>
        <ClientSubmissionForm />
      </Card>

      <Card className="p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold">طلباتي ({submissions.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">اسم العميل</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">تاريخ الإرسال</th>
                <th className="px-4 py-3 font-medium">ملاحظة الأدمن</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-foreground-muted">
                    لسه معملتش أي طلب.
                  </td>
                </tr>
              )}
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABELS[s.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">
                    {dateFmt.format(s.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {s.status === "rejected" ? s.rejectionReason || "—" : "—"}
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
