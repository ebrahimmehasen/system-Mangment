-- Private Storage bucket for project PDF files (نقطة 6).
--
-- private (public = false): objects are only reachable through short-lived
-- signed URLs generated server-side after the session is verified.
-- Bucket-level limits are a second line of defence on top of the app checks.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-files',
  'project-files',
  false,
  10485760,                 -- 10 MB (keep in sync with MAX_PROJECT_FILE_SIZE)
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No RLS policies on storage.objects for this bucket: the anon/authenticated
-- roles get no access at all. All reads/writes go through the service-role
-- client in trusted server code.
