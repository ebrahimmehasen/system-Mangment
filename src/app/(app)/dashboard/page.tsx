import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/Card";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">لوحة التحكم</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          أهلًا، {user.name || user.email}
        </p>
      </div>

      <Card>
        <p className="text-sm text-foreground-muted">
          الملخّص المالي والإحصائيات هيتبنوا في النقطة 9. دلوقتي تسجيل الدخول
          والحماية شغّالين.
        </p>
      </Card>
    </div>
  );
}
