-- ════════════════════════════════════════════════════════════════
-- Sistema de Feedback / Solicitações dos usuários
-- Usuários enviam bugs e pedidos de funcionalidade; o dono (admin)
-- gerencia o status. RLS: usuário vê/insere o seu; admin vê/edita tudo.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email      text,
  type            text NOT NULL DEFAULT 'feature' CHECK (type IN ('bug','feature')),
  title           text NOT NULL,
  description     text NOT NULL DEFAULT '',
  target_page     text,                         -- página onde a melhoria deve entrar
  needs_new_page  boolean NOT NULL DEFAULT false,
  new_page_name   text,                         -- nome da nova aba sugerida (se houver)
  priority        text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','planned','in_progress','done','discarded')),
  admin_note      text,                         -- anotação do dono
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS feedback_status_idx  ON public.feedback(status);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback(created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Email do dono (admin). Ajuste aqui se mudar.
-- Usamos o email do JWT para identificar o admin.

-- Usuário insere o seu próprio feedback
DROP POLICY IF EXISTS "feedback_insert_own" ON public.feedback;
CREATE POLICY "feedback_insert_own" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usuário lê o seu próprio; admin lê todos
DROP POLICY IF EXISTS "feedback_select_own_or_admin" ON public.feedback;
CREATE POLICY "feedback_select_own_or_admin" ON public.feedback
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'email') = 'ryan.stradioto@biasiengenharia.com.br'
  );

-- Apenas o admin atualiza (mudar status, anotações)
DROP POLICY IF EXISTS "feedback_update_admin" ON public.feedback;
CREATE POLICY "feedback_update_admin" ON public.feedback
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'ryan.stradioto@biasiengenharia.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'ryan.stradioto@biasiengenharia.com.br');

-- Admin pode excluir
DROP POLICY IF EXISTS "feedback_delete_admin" ON public.feedback;
CREATE POLICY "feedback_delete_admin" ON public.feedback
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'ryan.stradioto@biasiengenharia.com.br');

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.feedback_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS feedback_updated_at ON public.feedback;
CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_set_updated_at();
