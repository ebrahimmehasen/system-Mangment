"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { changePasswordAction, type ActionState } from "@/server/auth-actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    changePasswordAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4 sm:max-w-md"
    >
      <Input
        id="current-password"
        name="currentPassword"
        type="password"
        label="كلمة المرور الحالية"
        dir="ltr"
        autoComplete="current-password"
        required
      />
      <Input
        id="new-password-change"
        name="newPassword"
        type="password"
        label="كلمة المرور الجديدة (8 أحرف على الأقل)"
        dir="ltr"
        minLength={8}
        autoComplete="new-password"
        required
      />
      <Input
        id="confirm-password"
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
      {state.success && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          {state.success}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}
      </Button>
    </form>
  );
}
