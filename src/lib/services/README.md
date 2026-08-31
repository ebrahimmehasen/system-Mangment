# Business Logic (services)

Pure, framework-agnostic business logic lives here: financial calculations,
currency conversion, validation rules, aggregations.

Rules:

- No React, no `next/*` imports.
- No direct HTTP — receive plain data, return plain data.
- Database access goes through `@/lib/db`, not raw SQL here.
- All money math uses decimal-safe types (never JS `number` for currency).
