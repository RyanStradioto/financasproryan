alter table public.investments enable row level security;
alter table public.investment_transactions enable row level security;

drop policy if exists "Users manage own investments" on public.investments;
drop policy if exists "Users can view own investments" on public.investments;
drop policy if exists "Users can insert own investments" on public.investments;
drop policy if exists "Users can update own investments" on public.investments;
drop policy if exists "Users can delete own investments" on public.investments;

create policy "Users can view own investments"
on public.investments
for select
using (auth.uid() = user_id);

create policy "Users can insert own investments"
on public.investments
for insert
with check (auth.uid() = user_id);

create policy "Users can update own investments"
on public.investments
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own investments"
on public.investments
for delete
using (auth.uid() = user_id);

drop policy if exists "Users manage own investment_transactions" on public.investment_transactions;
drop policy if exists "Users can view own investment transactions" on public.investment_transactions;
drop policy if exists "Users can insert own investment transactions" on public.investment_transactions;
drop policy if exists "Users can update own investment transactions" on public.investment_transactions;
drop policy if exists "Users can delete own investment transactions" on public.investment_transactions;

create policy "Users can view own investment transactions"
on public.investment_transactions
for select
using (auth.uid() = user_id);

create policy "Users can insert own investment transactions"
on public.investment_transactions
for insert
with check (auth.uid() = user_id);

create policy "Users can update own investment transactions"
on public.investment_transactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own investment transactions"
on public.investment_transactions
for delete
using (auth.uid() = user_id);
