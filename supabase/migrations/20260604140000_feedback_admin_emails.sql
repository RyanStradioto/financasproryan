-- Reconhece o dono do app pela conta usada no app (amaralstradiotoryan@gmail.com),
-- alem do e-mail corporativo. As policies de admin do feedback passam a aceitar
-- qualquer um dos dois e-mails.

DROP POLICY IF EXISTS "feedback_select_own_or_admin" ON public.feedback;
CREATE POLICY "feedback_select_own_or_admin" ON public.feedback
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'email') IN ('amaralstradiotoryan@gmail.com', 'ryan.stradioto@biasiengenharia.com.br')
  );

DROP POLICY IF EXISTS "feedback_update_admin" ON public.feedback;
CREATE POLICY "feedback_update_admin" ON public.feedback
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('amaralstradiotoryan@gmail.com', 'ryan.stradioto@biasiengenharia.com.br'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('amaralstradiotoryan@gmail.com', 'ryan.stradioto@biasiengenharia.com.br'));

DROP POLICY IF EXISTS "feedback_delete_admin" ON public.feedback;
CREATE POLICY "feedback_delete_admin" ON public.feedback
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('amaralstradiotoryan@gmail.com', 'ryan.stradioto@biasiengenharia.com.br'));
