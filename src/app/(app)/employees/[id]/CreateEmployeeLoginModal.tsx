"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/Field";
import {
  createEmployeeLoginAction,
  type CreateEmployeeLoginState,
} from "@/server/employee-actions";

export function CreateEmployeeLoginModal({ employeeId }: { employeeId: string }) {
  const action = createEmployeeLoginAction.bind(null, employeeId);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CreateEmployeeLoginState>({});
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
      <Button variant="secondary" onClick={() => setOpen(true)}>
        إنشاء حساب دخول
      </Button>

      <Modal open={open} onClose={close} title="إنشاء حساب دخول للموظف">
        {state.success ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              {state.success}
            </p>
            <p className="text-xs text-foreground-muted">
              سلّم الموظف اسم المستخدم وكلمة المرور اللي اخترتها — هيستخدمهم لتسجيل الدخول.
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
              id="emp-login-username"
              name="username"
              label="اسم المستخدم (إنجليزي/أرقام)"
              dir="ltr"
              defaultValue={state.values?.username ?? ""}
              placeholder="mohamed.hosni"
              required
            />
            <p className="-mt-2 text-xs text-foreground-muted" dir="ltr">
              سيسجّل الدخول بالإيميل الداخلي: username@404legends.local
            </p>
            <TextField
              id="emp-login-password"
              name="password"
              type="password"
              label="كلمة المرور (8 أحرف على الأقل)"
              dir="ltr"
              minLength={8}
              required
            />

            {state.error && (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}

            <div className="mt-2 flex justify-start gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
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
