-- Habilita a extensão pg_cron se ainda não estiver habilitada
-- (já deve estar no Supabase, mas garantido)

-- Remove agendamentos anteriores se existirem (evita duplicatas)
SELECT cron.unschedule('weekly-email-summary') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-email-summary'
);
SELECT cron.unschedule('monthly-email-summary') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monthly-email-summary'
);

-- Resumo semanal: toda segunda-feira às 9h (UTC-3 = 12h UTC)
SELECT cron.schedule(
  'weekly-email-summary',
  '0 12 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/weekly-summary',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer {{SUPABASE_SERVICE_ROLE_KEY}}"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Relatório mensal: dia 1 de cada mês às 9h (UTC-3 = 12h UTC)
SELECT cron.schedule(
  'monthly-email-summary',
  '0 12 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/monthly-summary',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer {{SUPABASE_SERVICE_ROLE_KEY}}"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
