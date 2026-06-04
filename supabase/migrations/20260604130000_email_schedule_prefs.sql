-- Preferencias de agendamento de e-mail por usuario.
-- Cada usuario escolhe em quais dias / horario recebe os resumos e de
-- quais contas quer receber a analise individual.
-- Os defaults reproduzem exatamente o comportamento atual (segunda 9h / dia 1 9h).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_weekly_days        smallint[] NOT NULL DEFAULT '{1}',
  ADD COLUMN IF NOT EXISTS email_monthly_day        smallint   NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS email_hour               smallint   NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS email_per_account_enabled boolean   NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_account_ids        uuid[]     DEFAULT NULL;

COMMENT ON COLUMN public.profiles.email_weekly_days IS 'Dias da semana (0=Dom..6=Sab) em que o resumo semanal e enviado.';
COMMENT ON COLUMN public.profiles.email_monthly_day IS 'Dia do mes (1..28) em que o relatorio mensal e enviado.';
COMMENT ON COLUMN public.profiles.email_hour IS 'Hora (0..23, horario de Brasilia) em que os e-mails sao enviados.';
COMMENT ON COLUMN public.profiles.email_per_account_enabled IS 'Se verdadeiro, envia um e-mail individual por conta alem do consolidado.';
COMMENT ON COLUMN public.profiles.email_account_ids IS 'Contas que recebem analise individual. NULL = todas as contas com movimento.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_hour_range') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_email_hour_range CHECK (email_hour >= 0 AND email_hour <= 23);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_monthly_day_range') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_email_monthly_day_range CHECK (email_monthly_day >= 1 AND email_monthly_day <= 28);
  END IF;
END $$;
