"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextAreaField } from "@/components/ui/Field";
import {
  approveClientSubmissionAction,
  rejectClientSubmissionAction,
} from "@/server/client-submission-actions";

export function ClientSubmissionReviewRow({
  submission,
}: {
  submission: {
    id: string;
    name: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    submittedBy: { name: string } | null;
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
      const res = await approveClientSubmissionAction(submission.id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const res = await rejectClientSubmissionAction(submission.id, reason);
      if (res?.error) setError(res.error);
      else {
        setRejectOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{submission.name}</p>
          {submission.companyName && (
            <p className="text-xs text-foreground-muted">{submission.companyName}</p>
          )}
          <p className="mt-1 text-xs text-foreground-muted">
            {[submission.phone, submission.email].filter(Boolean).join(" — ") || "—"}
          </p>
          {submission.notes && <p className="mt-1 text-xs text-foreground-muted">{submission.notes}</p>}
          <p className="mt-1 text-xs text-foreground-muted">
            أرسله: {submission.submittedBy?.name ?? "—"}
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

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="رفض الطلب">
        <TextAreaField
          id={`reject-reason-${submission.id}`}
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
