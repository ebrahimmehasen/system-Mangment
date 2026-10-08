-- Security hardening.
--
-- 1) New auth users must NOT become admin by default, and must not be able to
--    pick their role through signup metadata (raw_user_meta_data is writable
--    by the user). Only raw_app_meta_data (service-role only) can grant it.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_app_meta_data ->> 'role', 'employee')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name  = COALESCE(NULLIF(EXCLUDED.name, ''), public.users.name);
  RETURN NEW;
END;
$$;

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'employee';

-- 2) The app reads/writes data only through Prisma (table owner, bypasses
--    RLS). Nothing needs PostgREST access with a user JWT, and the old
--    "authenticated can do anything" policies let any logged-in account
--    (e.g. an employee) read payroll etc. via the public anon key. Drop them;
--    RLS stays enabled, so with no policy every PostgREST request is denied.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public' AND roles = '{authenticated}'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;
