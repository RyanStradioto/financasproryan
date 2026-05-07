create table if not exists public.category_account_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  monthly_budget numeric(14,2) not null default 0 check (monthly_budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, account_id)
);

alter table public.category_account_budgets enable row level security;

drop policy if exists "Users manage own category account budgets" on public.category_account_budgets;
create policy "Users manage own category account budgets"
on public.category_account_budgets
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_category_account_budgets_user_category
  on public.category_account_budgets(user_id, category_id);

create index if not exists idx_category_account_budgets_account
  on public.category_account_budgets(account_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'update_category_account_budgets_updated_at'
  ) then
    create trigger update_category_account_budgets_updated_at
    before update on public.category_account_budgets
    for each row
    execute function public.update_updated_at_column();
  end if;
end $$;
