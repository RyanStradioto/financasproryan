-- Add monthly_summary_enabled column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_summary_enabled BOOLEAN DEFAULT false;
