-- Registro de exclusões recentes para permitir restauração de receitas e despesas
CREATE TABLE public.recent_deletions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL CHECK (table_name IN ('income', 'expenses')),
  record_id UUID NOT NULL,
  payload JSONB NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recent_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recent deletions" ON public.recent_deletions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_recent_deletions_user_deleted_at ON public.recent_deletions(user_id, deleted_at DESC);
