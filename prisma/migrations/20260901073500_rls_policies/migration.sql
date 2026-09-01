-- Row Level Security (نقطة 2)
--
-- The application server talks to Postgres through Prisma as the `postgres`
-- role, which owns these tables and therefore BYPASSES RLS. These policies
-- exist to lock down the auto-generated PostgREST / supabase-js API that is
-- reachable with the public anon key: without a valid authenticated session,
-- every request returns nothing.
--
--   anon           -> no policy  -> denied
--   authenticated  -> the two admins -> full access (audit_logs: read + append only)

-- Data tables: authenticated admins get full CRUD.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users', 'clients', 'projects', 'project_files', 'transactions',
    'payments', 'expenses', 'expense_categories', 'project_statuses',
    'payment_methods', 'settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true);',
      t || '_select_authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true);',
      t || '_insert_authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);',
      t || '_update_authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true);',
      t || '_delete_authenticated', t);
  END LOOP;
END $$;

-- Audit log: append-only. Readable and insertable, never updated or deleted.
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_select_authenticated" ON "audit_logs"
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_logs_insert_authenticated" ON "audit_logs"
  FOR INSERT TO authenticated WITH CHECK (true);
