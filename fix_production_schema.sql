-- =============================================================================
-- SCRIPT DE EMERGÊNCIA — FinançasPro
-- Aplicar no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/gashcjenhwamgxrrmbsa/sql/new
--
-- Este script é idempotente (seguro para rodar múltiplas vezes).
-- Ele garante que todas as migrações pendentes estejam aplicadas em produção.
-- =============================================================================

-- ── 1. SOFT DELETE: colunas deleted_at ──────────────────────────────────────
ALTER TABLE public.income    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.expenses  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_income_deleted   ON public.income(deleted_at)   WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON public.expenses(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.purge_old_soft_deletes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.income   WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';
  DELETE FROM public.expenses WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. RECENT DELETIONS (lixeira) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recent_deletions (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT        NOT NULL CHECK (table_name IN ('income', 'expenses')),
  record_id  UUID        NOT NULL,
  payload    JSONB       NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'recent_deletions'
      AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.recent_deletions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users manage own recent deletions" ON public.recent_deletions;
CREATE POLICY "Users manage own recent deletions"
  ON public.recent_deletions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recent_deletions_user_deleted_at
  ON public.recent_deletions(user_id, deleted_at DESC);

-- ── 3. TRIGGER: popula recent_deletions ao deletar receita/despesa ──────────
CREATE OR REPLACE FUNCTION public.log_recent_deletion()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.recent_deletions(user_id, table_name, record_id, payload)
  VALUES (OLD.user_id, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_income_deletion   ON public.income;
DROP TRIGGER IF EXISTS trg_log_expense_deletion  ON public.expenses;

CREATE TRIGGER trg_log_income_deletion
  BEFORE DELETE ON public.income
  FOR EACH ROW WHEN (OLD.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.log_recent_deletion();

CREATE TRIGGER trg_log_expense_deletion
  BEFORE DELETE ON public.expenses
  FOR EACH ROW WHEN (OLD.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.log_recent_deletion();

-- ── 4. ATTACHMENTS: colunas de comprovante ──────────────────────────────────
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS attachment_url  TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE public.income   ADD COLUMN IF NOT EXISTS attachment_url  TEXT;
ALTER TABLE public.income   ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Storage bucket para comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can upload own attachments'
  ) THEN
    CREATE POLICY "Users can upload own attachments" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can view own attachments'
  ) THEN
    CREATE POLICY "Users can view own attachments" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own attachments'
  ) THEN
    CREATE POLICY "Users can delete own attachments" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

-- ── 5. INVESTMENTS RLS ───────────────────────────────────────────────────────
ALTER TABLE public.investments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own investments"                  ON public.investments;
DROP POLICY IF EXISTS "Users can view own investments"                ON public.investments;
DROP POLICY IF EXISTS "Users can insert own investments"              ON public.investments;
DROP POLICY IF EXISTS "Users can update own investments"              ON public.investments;
DROP POLICY IF EXISTS "Users can delete own investments"              ON public.investments;

CREATE POLICY "Users can view own investments"   ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments" ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments" ON public.investments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments" ON public.investments FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own investment_transactions"           ON public.investment_transactions;
DROP POLICY IF EXISTS "Users can view own investment transactions"          ON public.investment_transactions;
DROP POLICY IF EXISTS "Users can insert own investment transactions"        ON public.investment_transactions;
DROP POLICY IF EXISTS "Users can update own investment transactions"        ON public.investment_transactions;
DROP POLICY IF EXISTS "Users can delete own investment transactions"        ON public.investment_transactions;

CREATE POLICY "Users can view own investment transactions"   ON public.investment_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investment transactions" ON public.investment_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investment transactions" ON public.investment_transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own investment transactions" ON public.investment_transactions FOR DELETE USING (auth.uid() = user_id);

-- ── 6. RECARREGAR O SCHEMA CACHE DO POSTGREST ────────────────────────────────
-- Isso resolve o "Database error querying schema" sem reiniciar o servidor.
NOTIFY pgrst, 'reload schema';

-- ── FIM ──────────────────────────────────────────────────────────────────────
-- Após rodar este script, o erro "Database error querying schema" deve
-- desaparecer e todos os usuários voltarão a conseguir fazer login.
