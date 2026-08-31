import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Temporary landing page.
 * Phase 3 replaces this with a session check that redirects to
 * /dashboard when signed in, or /login otherwise.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-surface text-xl font-bold text-accent">
        404
      </div>
      <div>
        <h1 dir="ltr" className="text-2xl font-semibold">
          404 Legends
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          نظام الإدارة الداخلي
        </p>
      </div>
      <Link href="/login">
        <Button>الدخول إلى النظام</Button>
      </Link>
    </main>
  );
}
