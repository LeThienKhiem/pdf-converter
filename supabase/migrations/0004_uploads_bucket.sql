-- Private storage bucket for large-file (5–25MB) uploads from paid users.
-- Files are downloaded and deleted by /api/extract immediately after processing.
-- (Already applied to production via Management API on 2026-08-23.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads',
  'uploads',
  false,
  26214400, -- 25MB
  array['application/pdf','image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set file_size_limit = 26214400;
