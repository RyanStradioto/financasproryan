-- =====================================================
-- MIGRATION: Add soft delete support + fix investment logic
-- =====================================================

-- 1. Add deleted_at column to income and expenses
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_income_deleted ON public.income(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON public.expenses(deleted_at) WHERE deleted_at IS NOT NULL;

-- 3. Auto-purge function: permanently delete items older than 30 days
CREATE OR REPLACE FUNCTION public.purge_old_soft_deletes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.income WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';
  DELETE FROM public.expenses WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done! Soft delete infrastructure is ready.
