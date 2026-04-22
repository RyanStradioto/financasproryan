-- Catch-up migration for production environments that missed the attachment setup.

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS attachment_name text;
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS attachment_name text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own attachments'
  ) THEN
    CREATE POLICY "Users can upload own attachments" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can view own attachments'
  ) THEN
    CREATE POLICY "Users can view own attachments" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own attachments'
  ) THEN
    CREATE POLICY "Users can delete own attachments" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
