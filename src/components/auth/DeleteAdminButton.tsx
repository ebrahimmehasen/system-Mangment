"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteAdminAction } from "@/server/auth-actions";

export function DeleteAdminButton({
  userId,
  label,
}: {
  userId: string;
  /** Display name/email shown in the confirmation dialog. */
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteAdminAction(userId);
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
        حذف الحساب
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="تأكيد حذف الحساب">
        <p className="text-sm text-foreground-muted">
          هل أنت متأكد من حذف حساب المشرف <span className="text-foreground">{label}</span>؟
          هيتحذف نهائيًا (تسجيل الدخول بتاعه هيتوقف فورًا) ولا يمكن التراجع عن هذا الإجراء.
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
