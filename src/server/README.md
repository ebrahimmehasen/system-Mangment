# Server actions & API layer

Server Actions (`"use server"`) and Route Handlers live here or in
`src/app/**/route.ts`. This layer is the ONLY place that:

- reads the Supabase session and enforces auth (server-side only),
- calls `@/lib/services/*` for business logic,
- calls `@/lib/db` for persistence.

UI components must never talk to the database or Supabase admin client directly.
