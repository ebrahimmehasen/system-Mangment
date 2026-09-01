"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/Logo";
import { NAV, isActive } from "./nav";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="القائمة"
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
      >
        {/* hamburger */}
        <span className="block h-0.5 w-5 bg-current" />
        <span className="mt-1 block h-0.5 w-5 bg-current" />
        <span className="mt-1 block h-0.5 w-5 bg-current" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className="relative flex h-full w-64 flex-col border-l border-border bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Logo size={28} />
                <span dir="ltr" className="text-sm font-semibold">
                  404 Legends
                </span>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-foreground-muted hover:bg-surface-2"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm",
                    isActive(pathname, item.href)
                      ? "bg-accent/10 text-accent"
                      : "text-foreground-muted hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
