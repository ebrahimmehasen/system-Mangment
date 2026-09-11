"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/Field";
import {
  resetUserPasswordAction,
  type ResetPasswordState,
} from "@/server/auth-actions";

/** Admin-privileged "reset someone else's password" — no current password needed. */
export function ResetPasswordModal({
  userId,
  label,
}: {
  userId: string;
  /** Display name/email shown in the modal title, e.g. the employee's or admin's name. */
  label: string;
}) {
  const action = resetUserPasswordAction.bind(null, userId);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ResetPasswordState>({});
  const [pending, startTransition] = useTransition();

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await action(state, formData);
      setState(result);
    });
  }

  function close() {
    setOpen(false);
    setState({});
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        إعادة تعيين كلمة المرور
      </Button>

      <Modal open={open} onClose={close} title={`إعادة تعيين كلمة مرور ${label}`}>
        {state.success ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              {state.success}
            </p>
            <div className="flex justify-start">
              <Button type="button" onClick={close}>
                تم
              </Button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <TextField
              id={`reset-pw-${userId}`}
              name="newPassword"
              type="password"
              label="كلمة المرور الجديدة (8 أحرف على الأقل)"
              dir="ltr"
              minLength={8}
              autoComplete="new-password"
              required
            />
            <TextField
              id={`reset-pw-confirm-${userId}`}
              name="confirmPassword"
              type="password"
              label="تأكيد كلمة المرور الجديدة"
              dir="ltr"
              minLength={8}
              autoComplete="new-password"
              required
            />

            {state.error && (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}

            <div className="mt-2 flex justify-start gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}
              </Button>
              <Button type="button" variant="ghost" onClick={close}>
                إلغاء
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
