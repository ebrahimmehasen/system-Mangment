# Server actions & API layer

Server Actions (`"use server"`) and Route Handlers live here or in
`src/app/**/route.ts`. This layer is the ONLY place that:

- reads the Supabase session and enforces auth (server-side only),
- calls `@/lib/services/*` for business logic,
- calls `@/lib/db` for persistence.

UI components must never talk to the database or Supabase admin client directly.

## Auth: requireUser() vs requireAdmin()

Since Phase 5 (employee-portal logins), `src/lib/auth.ts` exports two guards:

- `requireUser()` — any signed-in account, admin or employee. Use this ONLY
  when the action is genuinely meant to be callable by an employee: it's
  self-service (changing your own password, your own reminders), or it has
  its own internal ownership/role check narrowing what an employee can
  touch (e.g. `resetUserPasswordAction`, the target-client claim/activity
  actions, reminder ownership via `canActOnReminder`).
- `requireAdmin()` — rejects anyone whose `role !== "admin"`. Use this for
  everything else. Every mutating Server Action in this directory is
  admin-only by default; `requireUser()` is the deliberate exception, not
  the default. The same applies to Route Handlers in `src/app/api/**` —
  use `requireAdminApi()` from `@/lib/api-auth` there (a Route Handler
  can't call `requireAdmin()`, which redirects).

A missing admin check here isn't just a UI gap: an employee-portal login
can call a Server Action directly regardless of which page renders its
button, so getting this wrong is a real authorization bypass, not just a
cosmetic one. (Phase 5.10 QA found and fixed several — see the phase 5
plan doc/memory for the list.)
