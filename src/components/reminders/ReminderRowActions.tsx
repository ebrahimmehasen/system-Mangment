"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  toggleReminderDoneAction,
  snoozeReminderAction,
  deleteReminderAction,
} from "@/server/reminder-actions";
import { SNOOZE_OPTIONS } from "@/lib/services/reminders";

export function DoneCheckbox({
  reminderId,
  done,
}: {
  reminderId: string;
  done: boolean;
}) {
  const [checked, setChecked] = useState(done);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const prev = checked;
    setChecked(!prev);
    startTransition(async () => {
      const res = await toggleReminderDoneAction(reminderId);
      if (res?.error) setChecked(prev);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={checked ? "إلغاء الإنجاز" : "تعليم كمنتهي"}
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

/**
 * A native <select> rather than a custom absolutely-positioned menu:
 * this row sits inside a horizontally-scrolling table (overflow-x-auto),
 * which would clip a custom dropdown. A native select's popup is never
 * clipped by an ancestor's overflow.
 */
export function SnoozeMenu({ reminderId }: { reminderId: string }) {
  const [pending, startTransition] = useTransition();

  function snooze(hours: number) {
    startTransition(async () => {
      await snoozeReminderAction(reminderId, hours);
    });
  }

  return (
    <select
      defaultValue=""
      disabled={pending}
      onChange={(e) => {
        const hours = Number(e.target.value);
        if (hours) snooze(hours);
        e.target.value = "";
      }}
      className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-accent focus:border-accent focus:outline-none disabled:opacity-50"
    >
      <option value="" disabled>
        تأجيل
      </option>
      {SNOOZE_OPTIONS.map((o) => (
        <option key={o.hours} value={o.hours}>
          لمدة {o.label}
        </option>
      ))}
    </select>
  );
}

export function DeleteReminderButton({ reminderId }: { reminderId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteReminderAction(reminderId);
      if (res?.error) setError(res.error);
      else setOpen(false);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-danger hover:underline">
        حذف
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="تأكيد حذف التذكير">
        <p className="text-sm text-foreground-muted">
          هل أنت متأكد من حذف هذا التذكير؟ لا يمكن التراجع.
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
