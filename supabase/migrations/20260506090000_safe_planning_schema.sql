-- Safe additive migration for planning persistence and profile catch-up.
-- No user data is deleted, truncated, overwritten, or migrated destructively.

alter table public.profiles
  add column if not exists first_name text;

create table if not exists public.planning_fixed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null default 0,
  day integer not null default 1 check (day between 1 and 31),
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_salary_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  gross_override numeric(14,2) not null default 0,
  account_id uuid references public.accounts(id) on delete set null,
  first_split_pct integer not null default 60 check (first_split_pct between 0 and 100),
  description text not null default 'Salário',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planning_fixed_costs enable row level security;
alter table public.planning_salary_configs enable row level security;

drop policy if exists "Users manage own planning fixed costs" on public.planning_fixed_costs;
create policy "Users manage own planning fixed costs"
on public.planning_fixed_costs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own planning salary configs" on public.planning_salary_configs;
create policy "Users manage own planning salary configs"
on public.planning_salary_configs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_planning_fixed_costs_user_active
  on public.planning_fixed_costs(user_id, active);

create index if not exists idx_planning_fixed_costs_category
  on public.planning_fixed_costs(category_id);

create index if not exists idx_planning_fixed_costs_account
  on public.planning_fixed_costs(account_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'update_planning_fixed_costs_updated_at'
  ) then
    create trigger update_planning_fixed_costs_updated_at
    before update on public.planning_fixed_costs
    for each row
    execute function public.update_updated_at_column();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'update_planning_salary_configs_updated_at'
  ) then
    create trigger update_planning_salary_configs_updated_at
    before update on public.planning_salary_configs
    for each row
    execute function public.update_updated_at_column();
  end if;
end $$;

