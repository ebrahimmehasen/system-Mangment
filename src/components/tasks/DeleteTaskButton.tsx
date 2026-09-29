"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteTaskAction } from "@/server/task-actions";

export function DeleteTaskButton({ taskId, title }: { taskId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteTaskAction(taskId);
      if (res?.error) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} className="text-danger">
        حذف
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="تأكيد الحذف">
        <p className="text-sm text-foreground-muted">
          هل أنت متأكد من حذف المهمة <span className="text-foreground">{title}</span>؟
        </p>
        {error && (
          <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={confirmDelete} disabled={pending}>
            {pending ? "جارٍ الحذف…" : "تأكيد الحذف"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
        </div>
      </Modal>
    </>
  );
}
