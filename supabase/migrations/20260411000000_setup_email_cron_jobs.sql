-- Habilita a extensao pg_cron se ainda nao estiver habilitada.
-- IMPORTANTE:
-- Antes de executar manualmente, substitua {{CRON_SECRET}}
-- pelo mesmo valor salvo em `supabase secrets set CRON_SECRET=...`.

SELECT cron.unschedule('weekly-email-summary') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-email-summary'
);

SELECT cron.unschedule('monthly-email-summary') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monthly-email-summary'
);

-- Resumo semanal: toda segunda-feira as 9h de Brasilia (12h UTC)
SELECT cron.schedule(
  'weekly-email-summary',
  '0 12 * * 1',
  'SELECT net.http_post(
    url := ''https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/weekly-summary'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''x-cron-secret'', ''{{CRON_SECRET}}''
    ),
    body := ''{}''::jsonb
  ) AS request_id;'
);

-- Relatorio mensal: dia 1 de cada mes as 9h de Brasilia (12h UTC)
SELECT cron.schedule(
  'monthly-email-summary',
  '0 12 1 * *',
  'SELECT net.http_post(
    url := ''https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/monthly-summary'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''x-cron-secret'', ''{{CRON_SECRET}}''
    ),
    body := ''{}''::jsonb
  ) AS request_id;'
);
