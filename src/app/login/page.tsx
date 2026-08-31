"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

/**
 * Login screen — visual only for now.
 * Real Supabase Auth wiring is implemented in Phase 3 (نقطة 3).
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Intentionally no-op until Phase 3.
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface text-lg font-bold text-accent">
            404
          </div>
          <h1 dir="ltr" className="text-xl font-semibold">
            404 Legends
          </h1>
          <p dir="ltr" className="mt-1 text-sm text-foreground-muted">
            Where 404 Becomes Legend
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="email"
              type="email"
              label="البريد الإلكتروني"
              placeholder="you@404legend.space"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              dir="ltr"
            />
            <Input
              id="password"
              type="password"
              label="كلمة المرور"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
            />
            <Button type="submit" className="mt-2 w-full">
              تسجيل الدخول
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
