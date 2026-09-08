"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteCompanyAccountEntryAction } from "@/server/company-account-actions";

export function DeleteEntryButton({
  entryId,
  label,
}: {
  entryId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await deleteCompanyAccountEntryAction(entryId);
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

      <Modal open={open} onClose={() => setOpen(false)} title="تأكيد حذف الحركة">
        <p className="text-sm text-foreground-muted">
          حذف حركة <span className="text-foreground">{label}</span>؟ سيتأثر رصيد
          حساب الشركة. لا يمكن التراجع.
        </p>
        {error && (
          <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={confirm} disabled={pending}>
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
