-- Storage bucket for transaction attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

-- RLS for attachments bucket
CREATE POLICY "Users can upload own attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add attachment columns to expenses and income
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS attachment_name text;
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS attachment_name text;