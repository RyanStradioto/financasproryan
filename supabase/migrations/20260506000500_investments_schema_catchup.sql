-- Catch-up migration: ensure new investment customization fields exist
alter table public.investments
  add column if not exists annual_rate numeric(7,2) not null default 0,
  add column if not exists liquidity text not null default 'diaria',
  add column if not exists photo_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'investments_liquidity_check'
  ) then
    alter table public.investments
      add constraint investments_liquidity_check
      check (liquidity in ('diaria','d+1','d+30','d+360','vencimento'));
  end if;
end $$;
