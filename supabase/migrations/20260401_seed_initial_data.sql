-- Initial data seed for Financas Pro Ryan
-- This file contains sample data for testing and demonstration

-- NOTE: Uncomment and customize the VALUES with your user_id after creating an account

/*
-- Example for inserting sample categories:
INSERT INTO public.categories (user_id, name, icon, monthly_budget, color)
VALUES
  ('your-user-id-here', 'Alimentação', '🍔', 1000.00, '#ff6b6b'),
  ('your-user-id-here', 'Transporte', '🚗', 500.00, '#4ecdc4'),
  ('your-user-id-here', 'Saúde', '💊', 300.00, '#45b7d1'),
  ('your-user-id-here', 'Lazer', '🎮', 200.00, '#f7b731'),
  ('your-user-id-here', 'Casa', '🏠', 800.00, '#5f27cd');

-- Example for inserting sample accounts:
INSERT INTO public.accounts (user_id, name, icon, initial_balance, color)
VALUES
  ('your-user-id-here', 'Conta Corrente', '🏦', 5000.00, '#3B82F6'),
  ('your-user-id-here', 'Poupança', '🏦', 2000.00, '#10b981'),
  ('your-user-id-here', 'Carteira', '💰', 500.00, '#f59e0b');

-- Example for inserting sample expenses:
INSERT INTO public.expenses (user_id, date, description, amount, category_id, account_id, status)
VALUES
  ('your-user-id-here', CURRENT_DATE - INTERVAL '2 days', 'Supermercado', 150.00, (SELECT id FROM public.categories WHERE user_id = 'your-user-id-here' AND name = 'Alimentação' LIMIT 1), (SELECT id FROM public.accounts WHERE user_id = 'your-user-id-here' AND name = 'Conta Corrente' LIMIT 1), 'concluido'),
  ('your-user-id-here', CURRENT_DATE - INTERVAL '1 day', 'Uber', 45.00, (SELECT id FROM public.categories WHERE user_id = 'your-user-id-here' AND name = 'Transporte' LIMIT 1), (SELECT id FROM public.accounts WHERE user_id = 'your-user-id-here' AND name = 'Carteira' LIMIT 1), 'concluido'),
  ('your-user-id-here', CURRENT_DATE, 'Farmácia', 80.00, (SELECT id FROM public.categories WHERE user_id = 'your-user-id-here' AND name = 'Saúde' LIMIT 1), (SELECT id FROM public.accounts WHERE user_id = 'your-user-id-here' AND name = 'Conta Corrente' LIMIT 1), 'concluido');

-- Example for inserting sample income:
INSERT INTO public.income (user_id, date, description, amount, account_id, status)
VALUES
  ('your-user-id-here', CURRENT_DATE - INTERVAL '15 days', 'Salário', 5000.00, (SELECT id FROM public.accounts WHERE user_id = 'your-user-id-here' AND name = 'Conta Corrente' LIMIT 1), 'concluido'),
  ('your-user-id-here', CURRENT_DATE - INTERVAL '5 days', 'Freelance', 1500.00, (SELECT id FROM public.accounts WHERE user_id = 'your-user-id-here' AND name = 'Poupança' LIMIT 1), 'concluido');
*/

-- This is a template file. To populate your database:
-- 1. Sign up in the application at https://financasproryan.vercel.app
-- 2. Copy your user_id from Supabase auth table
-- 3. Replace 'your-user-id-here' with your actual user_id
-- 4. Uncomment the SQL above
-- 5. Run in Supabase SQL Editor
