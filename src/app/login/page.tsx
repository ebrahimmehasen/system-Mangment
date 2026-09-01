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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 rounded-2xl border border-border bg-surface/60 p-3 backdrop-blur">
            <Logo size={52} />
          </div>
          <h1 dir="ltr" className="text-xl font-semibold tracking-tight">
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
