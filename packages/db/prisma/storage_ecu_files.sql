-- Run this ONCE in the Supabase SQL editor to set up the ECU file storage bucket.
--
-- NOTE (ADR-006): Supabase Storage is used temporarily for MVP.
-- Target: Cloudflare R2 — swap `uploadCommit` in apps/web/src/app/actions/projects.ts.
--
-- Storage key format: {projectId}/{sha256checksum}.{ext}
-- Authorization is enforced at the server-action level (ownership check before upload).
-- These policies are a second layer: they restrict access to authenticated users only.

-- ─── Bucket ───────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ecu-files',
  'ecu-files',
  false,                           -- private; no direct public URL access
  5242880,                         -- 5 MB max per file (MS4x ECUs are 256 KB–1 MB)
  ARRAY['application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- Upload: any authenticated user may upload.
-- Ownership is validated in the server action before this point.
CREATE POLICY "ecu_files_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ecu-files');

-- Read: any authenticated user may read.
-- Public-project access for unauthenticated users is deferred to Phase 2
-- (requires checking projects.visibility = 'PUBLIC' against the path prefix).
CREATE POLICY "ecu_files_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'ecu-files');

-- Delete: blocked at storage level.
-- Files are content-addressed (checksum = filename) and immutable by design —
-- the same binary can be referenced by multiple FileVersion records.
-- Deletion is managed by the application layer when all referencing FileVersions are removed.
