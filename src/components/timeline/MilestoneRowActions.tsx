"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  toggleMilestoneCompleteAction,
  deleteMilestoneAction,
  moveMilestoneAction,
} from "@/server/milestone-actions";

export function CompleteCheckbox({
  milestoneId,
  completed,
}: {
  milestoneId: string;
  completed: boolean;
}) {
  const [checked, setChecked] = useState(completed);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const prev = checked;
    setChecked(!prev);
    startTransition(async () => {
      const res = await toggleMilestoneCompleteAction(milestoneId);
      if (res?.error) setChecked(prev);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={checked ? "إلغاء الإنجاز" : "تعليم كمكتملة"}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
        checked
          ? "border-success bg-success text-white"
          : "border-border bg-surface-2 hover:border-accent"
      } disabled:opacity-50`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
          <path d="M13.7 3.3a1 1 0 0 1 0 1.4l-6.5 6.5a1 1 0 0 1-1.4 0L2.3 7.7a1 1 0 1 1 1.4-1.4L6.5 9.1l5.8-5.8a1 1 0 0 1 1.4 0Z" />
        </svg>
      )}
    </button>
  );
}

export function MoveButtons({ milestoneId }: { milestoneId: string }) {
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await moveMilestoneAction(milestoneId, direction);
    });
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => move("up")}
        disabled={pending}
        aria-label="تحريك لأعلى"
        className="text-foreground-muted hover:text-foreground disabled:opacity-40"
      >
        ▲
      </button>
      <button
        type="button"
        onClick={() => move("down")}
        disabled={pending}
        aria-label="تحريك لأسفل"
        className="text-foreground-muted hover:text-foreground disabled:opacity-40"
      >
        ▼
      </button>
    </div>
  );
}

export function DeleteMilestoneButton({ milestoneId }: { milestoneId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteMilestoneAction(milestoneId);
      if (res?.error) setError(res.error);
      else setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-danger hover:underline"
      >
        حذف
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="تأكيد حذف المرحلة">
        <p className="text-sm text-foreground-muted">
          هل أنت متأكد من حذف هذه المرحلة؟ لا يمكن التراجع.
        </p>
        {error && (
          <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
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
