"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/server/auth-actions";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/employee", label: "الرئيسية" },
  { href: "/employee/leads", label: "العملاء المستهدفون" },
  { href: "/employee/projects", label: "مشاريعي" },
  { href: "/employee/reminders", label: "التقويم والتذكيرات" },
];

export function EmployeePortalHeader({ employeeName }: { employeeName: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="flex h-14 items-center gap-4 px-3 sm:px-4">
        <Link href="/employee" className="flex items-center gap-2">
          <Logo size={28} />
          <span dir="ltr" className="hidden text-sm font-semibold tracking-tight sm:block">
            404 LAGEND
          </span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-foreground-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden text-sm text-foreground-muted sm:block">{employeeName}</div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-md px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            خروج
          </button>
        </form>
      </div>
    </header>
  );
}
