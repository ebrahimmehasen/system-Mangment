"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/Field";
import { adminForwardTaskAction } from "@/server/task-actions";

export function ForwardAssigneeButton({
  taskId,
  fromUserId,
  fromLabel,
  candidates,
}: {
  taskId: string;
  fromUserId: string;
  fromLabel: string;
  candidates: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toUserId, setToUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = candidates.filter((c) => c.id !== fromUserId);

  function submit() {
    if (!toUserId) {
      setError("اختار الشخص اللي هتفروورد له.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await adminForwardTaskAction(taskId, fromUserId, toUserId);
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

      <Modal open={open} onClose={() => setOpen(false)} title={`فروردة مهمة من ${fromLabel}`}>
        <SelectField
          id={`forward-to-${taskId}-${fromUserId}`}
          label="لمين؟"
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
        >
          <option value="">— اختر —</option>
          {options.map((o) => (
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
