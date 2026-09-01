import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/datetime";
import {
  milestoneProgress,
  isOverdue,
  type MilestoneRow,
} from "@/lib/services/milestones";
import {
  createMilestoneAction,
  updateMilestoneAction,
} from "@/server/milestone-actions";
import { MilestoneFormModal } from "./MilestoneFormModal";
import {
  CompleteCheckbox,
  MoveButtons,
  DeleteMilestoneButton,
} from "./MilestoneRowActions";

export function MilestonesTimeline({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: MilestoneRow[];
}) {
  const progress = milestoneProgress(milestones);
  const sorted = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold">
            الجدول الزمني ({progress.done} من {progress.total})
          </h2>
          {progress.total > 0 && (
            <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          )}
        </div>
        <MilestoneFormModal
          mode="create"
          action={createMilestoneAction.bind(null, projectId)}
          triggerLabel="+ مرحلة"
          triggerVariant="secondary"
        />
      </div>

      {sorted.length === 0 ? (
        <p className="p-4 text-sm text-foreground-muted">
          لا توجد مراحل لهذا المشروع بعد.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {sorted.map((m) => {
            const overdue = isOverdue(m);
            return (
              <li key={m.id} className="flex items-start gap-3 p-4">
                <MoveButtons milestoneId={m.id} />
                <div className="pt-0.5">
                  <CompleteCheckbox
                    milestoneId={m.id}
                    completed={!!m.completedAt}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        m.completedAt
                          ? "text-foreground-muted line-through"
                          : "text-foreground"
                      }
                    >
                      {m.title}
                    </span>
                    {overdue && <Badge tone="danger">متأخرة</Badge>}
                    {m.completedAt && <Badge tone="success">مكتملة</Badge>}
                  </div>
                  {m.dueDate && (
                    <p className="mt-1 text-xs text-foreground-muted">
                      الاستحقاق: {formatDate(m.dueDate)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MilestoneFormModal
                    mode="edit"
                    action={updateMilestoneAction.bind(null, m.id)}
                    milestone={{
                      title: m.title,
                      description: m.description,
                      dueDate: m.dueDate
                        ? m.dueDate.toISOString().slice(0, 10)
                        : "",
                    }}
                    triggerLabel="تعديل"
                    triggerVariant="secondary"
                  />
                  <DeleteMilestoneButton milestoneId={m.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
