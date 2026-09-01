import Link from "next/link";
import { cn } from "@/lib/cn";

export function Pagination({
  page,
  totalPages,
  makeHref,
}: {
  page: number;
  totalPages: number;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <PageLink disabled={page <= 1} href={makeHref(page - 1)}>
        السابق
      </PageLink>
      <span className="text-foreground-muted">
        صفحة {page} من {totalPages}
      </span>
      <PageLink disabled={page >= totalPages} href={makeHref(page + 1)}>
        التالي
      </PageLink>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const cls = cn(
    "rounded-md border border-border px-3 py-1.5",
    disabled
      ? "pointer-events-none opacity-40"
      : "hover:bg-surface-2",
  );
  if (disabled) return <span className={cls}>{children}</span>;
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
