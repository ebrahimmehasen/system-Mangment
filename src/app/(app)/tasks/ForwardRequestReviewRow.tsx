"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextAreaField } from "@/components/ui/Field";
import {
  approveForwardRequestAction,
  rejectForwardRequestAction,
} from "@/server/task-actions";

export function ForwardRequestReviewRow({
  request,
}: {
  request: {
    id: string;
    task: { title: string };
    fromUser: { name: string | null; email: string };
    toUser: { name: string | null; email: string };
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await approveForwardRequestAction(request.id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const res = await rejectForwardRequestAction(request.id, reason);
      if (res?.error) setError(res.error);
      else {
        setRejectOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium">{request.task.title}</p>
          <p className="text-xs text-foreground-muted">
            من {request.fromUser.name || request.fromUser.email} إلى{" "}
            {request.toUser.name || request.toUser.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={approve} disabled={pending}>
            {pending ? "جارٍ…" : "موافقة"}
          </Button>
          <Button variant="danger" onClick={() => setRejectOpen(true)} disabled={pending}>
            رفض
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="رفض طلب الفروردة">
        <TextAreaField
          id={`reject-fwd-${request.id}`}
          label="سبب الرفض (اختياري)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={reject} disabled={pending}>
            {pending ? "جارٍ الرفض…" : "تأكيد الرفض"}
          </Button>
          <Button variant="ghost" onClick={() => setRejectOpen(false)}>
            إلغاء
          </Button>
        </div>
      </Modal>
    </div>
  );
}
