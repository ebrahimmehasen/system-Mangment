import { signOutAction } from "@/server/auth-actions";
import type { CurrentUser } from "@/lib/auth";
import { SearchBox } from "./SearchBox";
import { MobileNav } from "./MobileNav";

export function Topbar({ user }: { user: CurrentUser }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4">
      <MobileNav />
      <div className="flex-1">
        <SearchBox />
      </div>
      <div className="hidden text-sm text-foreground-muted sm:block">
        {user.name || user.email}
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-md px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          خروج
        </button>
      </form>
    </header>
  );
}
