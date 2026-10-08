"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/Field";
import { adminForwardTaskAction } from "@/server/task-actions";

/** Admin hands THEIR OWN share of a task to someone else (rendered only on tasks the admin is assigned to). */
export function ForwardAssigneeButton({
  taskId,
  candidates,
}: {
  taskId: string;
  candidates: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toUserId, setToUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!toUserId) {
      setError("اختار الشخص اللي هتفروورد له.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await adminForwardTaskAction(taskId, toUserId);
      if (res?.error) setError(res.error);
      else {
        setOpen(false);
        setToUserId("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-accent hover:underline"
      >
        فروردة
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="فروردة المهمة">
        <SelectField
          id={`forward-to-${taskId}`}
          label="لمين؟"
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
        >
          <option value="">— اختر —</option>
          {candidates.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </SelectField>

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <div className="mt-4 flex gap-2">
          <Button onClick={submit} disabled={pending}>
            {pending ? "جارٍ الفروردة…" : "تأكيد الفروردة"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
        </div>
      </Modal>
    </>
  );
}
