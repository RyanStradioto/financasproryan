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
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdhc2hjamVuaHdhbWd4cnJtYnNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg3ODYzNywiZXhwIjoyMDg5NDU0NjM3fQ.7akyYx2tZfbol2xJHg7X3n5SuyJLbt8CKbl0t1enatI"}'::jsonb,
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
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdhc2hjamVuaHdhbWd4cnJtYnNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg3ODYzNywiZXhwIjoyMDg5NDU0NjM3fQ.7akyYx2tZfbol2xJHg7X3n5SuyJLbt8CKbl0t1enatI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
