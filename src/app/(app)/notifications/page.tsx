import { requireUser } from "@/lib/auth";
import { getActiveAlerts } from "@/lib/get-alerts";
import { Card } from "@/components/ui/Card";
import { NotificationsList } from "./NotificationsList";

export default async function NotificationsPage() {
  const user = await requireUser();
  const alerts = await getActiveAlerts(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">التنبيهات</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {alerts.length} تنبيه نشط — محسوبة تلقائيًا من مواعيد التسليم والاجتماعات
          والمراحل والتذكيرات والمستحقات.
        </p>
      </div>

      <Card className="p-0">
        <NotificationsList alerts={alerts} />
      </Card>
    </div>
  );
}
