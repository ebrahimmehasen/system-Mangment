"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteProjectFileAction } from "@/server/file-actions";

export function DeleteFileButton({
  fileId,
  fileName,
}: {
  fileId: string;
  fileName: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteProjectFileAction(fileId);
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

      <Modal open={open} onClose={() => setOpen(false)} title="تأكيد حذف الملف">
        <p className="text-sm text-foreground-muted">
          حذف الملف <span className="text-foreground">{fileName}</span>؟ لا يمكن
          التراجع.
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
