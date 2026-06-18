-- Add B-tree indexes on foreign-key columns that were missing one.
-- Every query filters by user_id (RLS + app scoping); without these indexes
-- Postgres falls back to sequential scans, which degrades as rows grow.
-- Idempotent (IF NOT EXISTS) — safe to re-run.

create index if not exists idx_accounts_user                 on public.accounts(user_id);
create index if not exists idx_categories_user               on public.categories(user_id);
create index if not exists idx_credit_cards_user             on public.credit_cards(user_id);
create index if not exists idx_investments_user              on public.investments(user_id);
create index if not exists idx_recent_deletions_user         on public.recent_deletions(user_id);
create index if not exists idx_cc_tx_category                on public.credit_card_transactions(category_id);
create index if not exists idx_inv_tx_account                on public.investment_transactions(account_id);
create index if not exists idx_planning_salary_account       on public.planning_salary_configs(account_id);
create index if not exists idx_classification_category       on public.transaction_classifications(category_id);
create index if not exists idx_classification_investment     on public.transaction_classifications(investment_id);
