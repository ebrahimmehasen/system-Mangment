"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  uploadEmployeeCvAction,
  deleteEmployeeCvAction,
  type CvActionState,
} from "@/server/employee-actions";

export function CvSection({
  employeeId,
  cvFileName,
}: {
  employeeId: string;
  cvFileName: string | null;
}) {
  const action = uploadEmployeeCvAction.bind(null, employeeId);
  const [state, formAction, pending] = useActionState<CvActionState, FormData>(
    action,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  function confirmDelete() {
    setDelError(null);
    startDelete(async () => {
      const res = await deleteEmployeeCvAction(employeeId);
      if (res?.error) setDelError(res.error);
      else setConfirmOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {cvFileName ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-foreground-muted">الملف الحالي:</span>
          <span>{cvFileName}</span>
          <a
            href={`/api/employees/${employeeId}/cv`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            عرض
          </a>
          <a
            href={`/api/employees/${employeeId}/cv?mode=download`}
            className="text-accent hover:underline"
          >
            تنزيل
          </a>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="text-danger hover:underline"
          >
            حذف
          </button>
        </div>
      ) : (
        <p className="text-sm text-foreground-muted">لا توجد سيرة ذاتية مرفوعة.</p>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="cv"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
            className="text-sm text-foreground-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-surface"
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "جارٍ الرفع…" : cvFileName ? "استبدال" : "رفع"}
          </Button>
        </div>
        <p className="text-xs text-foreground-muted">
          PDF / DOC / DOCX — بحد أقصى 10 ميجابايت.
        </p>
        {state.error && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            {state.success}
          </p>
        )}
      </form>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="تأكيد حذف السيرة الذاتية"
      >
        <p className="text-sm text-foreground-muted">
          حذف <span className="text-foreground">{cvFileName}</span>؟ لا يمكن
          التراجع.
        </p>
        {delError && (
          <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {delError}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? "جارٍ الحذف…" : "تأكيد الحذف"}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            إلغاء
          </Button>
        </div>
      </Modal>
    </div>
  );
}
