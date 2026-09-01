import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { AddAdminForm } from "./AddAdminForm";

export default async function TeamPage() {
  const me = await requireUser();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">المشرفون</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          كل المشرفين لهم نفس الصلاحيات الكاملة.
        </p>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">البريد الإلكتروني</th>
                <th className="px-4 py-3 font-medium">الدور</th>
                <th className="px-4 py-3 font-medium">أُضيف في</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    {u.name || "—"}
                    {u.id === me.id && (
                      <span className="mr-2 text-xs text-foreground-muted">
                        (أنت)
                      </span>
                    )}
                  </td>
                  <td dir="ltr" className="px-4 py-3 text-right">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3">{dateFmt.format(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold">إضافة مشرف جديد</h2>
        <AddAdminForm />
      </Card>
    </div>
  );
}
