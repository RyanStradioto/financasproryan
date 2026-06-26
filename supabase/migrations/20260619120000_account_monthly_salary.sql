-- Renda mensal (salário) por conta.
-- O usuário recebe em mais de uma conta (ex: holerite no banco, VR, Alelo).
-- A soma do monthly_salary de todas as contas = salário total, que alimenta
-- os coeficientes (valor/hora, valor/dia), o orçamento por categoria e os insights.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS monthly_salary numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.accounts.monthly_salary IS
  'Renda mensal (salário) que cai nesta conta. A soma de todas as contas = salário total.';
