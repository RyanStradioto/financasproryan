-- DIAGNOSTICO COMPLETO DO AUTH
-- Cole tudo no SQL Editor e clique Run

-- 1. Versão das migrations internas do GoTrue
SELECT * FROM auth.schema_migrations ORDER BY version DESC LIMIT 20;

