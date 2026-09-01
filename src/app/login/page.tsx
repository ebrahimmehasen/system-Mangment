"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/Logo";
import { signInAction, type ActionState } from "@/server/auth-actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signInAction,
    {},
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={56} className="mb-3" />
          <h1 dir="ltr" className="text-xl font-semibold">
            404 Legends
          </h1>
          <p dir="ltr" className="mt-1 text-sm text-foreground-muted">
            Where 404 Becomes Legend
          </p>
        </div>

        <Card>
          {/* key forces the uncontrolled inputs to remount after each
              action result so the email can be repopulated on error */}
          <form
            key={state.error ? state.values?.email : "fresh"}
            action={formAction}
            className="flex flex-col gap-4"
          >
            <Input
              id="email"
              name="email"
              type="email"
              label="البريد الإلكتروني"
              placeholder="you@404legend.space"
              autoComplete="email"
              defaultValue={state.values?.email ?? ""}
              dir="ltr"
              required
            />
            <Input
              id="password"
              name="password"
              type="password"
              label="كلمة المرور"
              placeholder="••••••••"
              autoComplete="current-password"
              dir="ltr"
              required
            />

            {state.error && (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}

            <Button type="submit" className="mt-2 w-full" disabled={pending}>
              {pending ? "جارٍ الدخول…" : "تسجيل الدخول"}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-foreground-muted">
          نظام إدارة داخلي — الدخول للمصرّح لهم فقط
        </p>
      </div>
    </main>
  );
}
