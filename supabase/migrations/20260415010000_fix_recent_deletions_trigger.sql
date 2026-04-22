-- =====================================================
-- FIX: Remove triggers that reference the non-existent
-- 'recent_deletions' table, which causes DELETE errors.
-- =====================================================

-- 1. Drop triggers on expenses table that reference recent_deletions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tgname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE n.nspname = 'public'
      AND c.relname IN ('expenses', 'income', 'categories', 'accounts',
                         'investments', 'investment_transactions',
                         'credit_cards', 'credit_card_transactions')
      AND p.prosrc ILIKE '%recent_deletions%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.expenses', r.tgname);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.income', r.tgname);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.categories', r.tgname);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.accounts', r.tgname);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.investments', r.tgname);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.investment_transactions', r.tgname);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.credit_cards', r.tgname);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.credit_card_transactions', r.tgname);
    RAISE NOTICE 'Dropped trigger: %', r.tgname;
  END LOOP;
END $$;

-- 2. Drop any functions that reference recent_deletions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, n.nspname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosrc ILIKE '%recent_deletions%'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I() CASCADE', r.nspname, r.proname);
    RAISE NOTICE 'Dropped function: %.%', r.nspname, r.proname;
  END LOOP;
END $$;

-- 3. Drop the recent_deletions table if it somehow partially exists
DROP TABLE IF EXISTS public.recent_deletions CASCADE;

-- Done! DELETE operations should now work correctly.
