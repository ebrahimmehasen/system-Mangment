"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createAdminAction, type ActionState } from "@/server/auth-actions";

export function AddAdminForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createAdminAction,
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
      <Input id="name" name="name" label="الاسم" required />
      <Input
        id="new-email"
        name="email"
        type="email"
        label="البريد الإلكتروني"
        dir="ltr"
        required
      />
      <Input
        id="new-password"
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
      {state.success && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          {state.success}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "جارٍ الإضافة…" : "إضافة مشرف"}
      </Button>
    </form>
  );
}
