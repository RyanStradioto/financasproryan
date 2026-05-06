select 'income' as table_name, count(*) as row_count from public.income
union all select 'expenses', count(*) from public.expenses
union all select 'accounts', count(*) from public.accounts
union all select 'categories', count(*) from public.categories
union all select 'credit_cards', count(*) from public.credit_cards
union all select 'credit_card_transactions', count(*) from public.credit_card_transactions
union all select 'investments', count(*) from public.investments
union all select 'investment_transactions', count(*) from public.investment_transactions
union all select 'profiles', count(*) from public.profiles
order by table_name;