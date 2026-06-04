-- Reagenda os e-mails para rodar de hora em hora.
-- A propria funcao (weekly-summary / monthly-summary) decide QUEM recebe a cada
-- execucao, comparando o dia da semana / dia do mes / horario atual (America/Sao_Paulo)
-- com as preferencias salvas em profiles. Assim cada usuario recebe no dia e hora
-- que escolheu, sem precisar de um cron por usuario.
--
-- IMPORTANTE: antes de rodar, troque {{CRON_SECRET}} pelo valor salvo em
-- `supabase secrets set CRON_SECRET=...`.

SELECT cron.unschedule('weekly-email-summary') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-email-summary'
);

SELECT cron.unschedule('monthly-email-summary') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monthly-email-summary'
);

-- Resumo semanal: toda hora cheia. A funcao filtra por dia da semana + horario do usuario.
SELECT cron.schedule(
  'weekly-email-summary',
  '0 * * * *',
  'SELECT net.http_post(
    url := ''https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/weekly-summary'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''x-cron-secret'', ''{{CRON_SECRET}}''
    ),
    body := ''{}''::jsonb
  ) AS request_id;'
);

-- Relatorio mensal: toda hora cheia. A funcao filtra por dia do mes + horario do usuario.
SELECT cron.schedule(
  'monthly-email-summary',
  '0 * * * *',
  'SELECT net.http_post(
    url := ''https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/monthly-summary'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''x-cron-secret'', ''{{CRON_SECRET}}''
    ),
    body := ''{}''::jsonb
  ) AS request_id;'
);
