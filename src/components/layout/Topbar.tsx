import { signOutAction } from "@/server/auth-actions";
import type { CurrentUser } from "@/lib/auth";
import { SearchBox } from "./SearchBox";

export function Topbar({ user }: { user: CurrentUser }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
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
          تسجيل الخروج
        </button>
      </form>
    </header>
  );
}
