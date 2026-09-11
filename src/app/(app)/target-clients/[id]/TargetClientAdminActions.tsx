"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  deleteTargetClientAction,
  setTargetClientHiddenAction,
  setTargetClientInactiveAction,
  unassignTargetClientAction,
} from "@/server/target-client-actions";

export function TargetClientAdminActions({
  targetClientId,
  companyName,
  hidden,
  status,
  isClaimed,
}: {
  targetClientId: string;
  companyName: string;
  hidden: boolean;
  status: string;
  isClaimed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleHidden() {
    setError(null);
    startTransition(async () => {
      const res = await setTargetClientHiddenAction(targetClientId, !hidden);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function deactivate() {
    setError(null);
    startTransition(async () => {
      const res = await setTargetClientInactiveAction(targetClientId);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function unassign() {
    setError(null);
    startTransition(async () => {
      const res = await unassignTargetClientAction(targetClientId);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function doDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteTargetClientAction(targetClientId);
      if (res?.error) setError(res.error);
      else setConfirmDelete(false);
    });
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <Button variant="secondary" onClick={toggleHidden} disabled={pending}>
        {hidden ? "إظهار للموظفين" : "إخفاء عن الموظفين"}
      </Button>
      {(isClaimed || status === "won" || status === "lost") && (
        <Button variant="secondary" onClick={unassign} disabled={pending}>
          فك التعيين (يرجع متاح)
        </Button>
      )}
      {status !== "inactive" && (
        <Button variant="secondary" onClick={deactivate} disabled={pending}>
          تعطيل
        </Button>
      )}
      <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={pending}>
        حذف
      </Button>

      {error && (
        <p className="w-full rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="تأكيد الحذف"
      >
        <p className="text-sm text-foreground-muted">
          هل أنت متأكد من حذف العميل المستهدف{" "}
          <span className="text-foreground">{companyName}</span>؟ لا يمكن التراجع عن هذا
          الإجراء.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={doDelete} disabled={pending}>
            {pending ? "جارٍ الحذف…" : "تأكيد الحذف"}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            إلغاء
          </Button>
        </div>
      </Modal>
    </div>
  );
}
