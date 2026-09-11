import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/server/auth-actions";

export default async function EmployeePendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.user.findUnique({ where: { id: user.id } });
  // An admin who lands here by mistake belongs in the real app.
  if (profile?.role === "admin") redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />
      <div className="relative w-full max-w-sm text-center">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-4 rounded-2xl border border-border bg-surface/60 p-3 backdrop-blur">
            <Logo size={52} />
          </div>
          <h1 dir="ltr" className="text-xl font-semibold tracking-tight">
            404 LAGEND
          </h1>
        </div>
        <Card>
          <h2 className="mb-2 text-base font-semibold">بوابة الموظفين قريبًا</h2>
          <p className="text-sm text-foreground-muted">
            حسابك جاهز، لكن بوابة الموظفين لسه قيد التجهيز. هتقدر تدخل عليها هنا لما تكون
            متاحة.
          </p>
          <form action={signOutAction} className="mt-6">
            <Button type="submit" variant="secondary" className="w-full">
              تسجيل خروج
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
