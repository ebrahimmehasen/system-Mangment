"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/Logo";

interface NavItem {
  href: string;
  label: string;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/clients", label: "العملاء" },
  { href: "/projects", label: "المشاريع" },
  { href: "/payments", label: "المدفوعات" },
  { href: "/expenses", label: "المصروفات" },
  { href: "/team", label: "المشرفون" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-l border-border bg-surface p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <Logo size={28} />
        <span dir="ltr" className="text-sm font-semibold">
          404 Legends
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-foreground-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
