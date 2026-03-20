-- Remove duplicates from income for Feb 2026, keeping only one of each
DELETE FROM income
WHERE id NOT IN (
  SELECT MIN(id::text)::uuid
  FROM income
  WHERE date >= '2026-02-01' AND date <= '2026-02-28'
  GROUP BY description, date, amount
)
AND date >= '2026-02-01' AND date <= '2026-02-28';

-- Remove duplicates from expenses for Feb 2026, keeping only one of each
DELETE FROM expenses
WHERE id NOT IN (
  SELECT MIN(id::text)::uuid
  FROM expenses
  WHERE date >= '2026-02-01' AND date <= '2026-02-28'
  GROUP BY description, date, amount
)
AND date >= '2026-02-01' AND date <= '2026-02-28';

-- Also remove the "Pagamento de fatura" entries since we have the detailed CC transactions
DELETE FROM expenses
WHERE date >= '2026-02-01' AND date <= '2026-02-28'
AND LOWER(description) LIKE '%pagamento de fatura%';