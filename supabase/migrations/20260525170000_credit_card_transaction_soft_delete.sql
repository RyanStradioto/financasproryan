alter table public.credit_card_transactions
  add column if not exists deleted_at timestamptz default null;

create index if not exists idx_credit_card_transactions_deleted
  on public.credit_card_transactions(deleted_at)
  where deleted_at is not null;

create or replace function public.purge_old_soft_deletes()
returns void as $$
begin
  delete from public.income where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.expenses where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.credit_card_transactions where deleted_at is not null and deleted_at < now() - interval '30 days';
end;
$$ language plpgsql security definer;
