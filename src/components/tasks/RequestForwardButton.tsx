"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/Field";
import { requestForwardTaskAction } from "@/server/task-actions";

export function RequestForwardButton({
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
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!toUserId) {
      setError("اختار الشخص اللي عايز تفروورد له.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await requestForwardTaskAction(taskId, toUserId);
      if (res?.error) setError(res.error);
      else {
        setDone(true);
        router.refresh();
      }
    });
  }

  function close() {
    setOpen(false);
    setDone(false);
    setToUserId("");
    setError(null);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-accent hover:underline">
        طلب فروردة
      </button>

      <Modal open={open} onClose={close} title="طلب فروردة المهمة">
        {done ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-success">
              تم إرسال الطلب للأدمن — هيظهرلك رد الطلب هنا.
            </p>
            <div>
              <Button onClick={close}>تم</Button>
            </div>
          </div>
        ) : (
          <>
            <SelectField
              id={`req-forward-${taskId}`}
              label="لمين؟"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
            >
              <option value="">— اختر —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </SelectField>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button onClick={submit} disabled={pending}>
                {pending ? "جارٍ الإرسال…" : "إرسال الطلب"}
              </Button>
              <Button variant="ghost" onClick={close}>
                إلغاء
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
