-- ============================================================
-- Investments as Patrimonial Assets (NOT expenses)
-- ============================================================

CREATE TABLE public.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'outro' CHECK (type IN ('cdb','lci','lca','tesouro','acoes','fii','poupanca','caixinha','fundo','cripto','outro')),
  institution TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '📈',
  color TEXT NOT NULL DEFAULT '#10b981',
  current_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_invested NUMERIC(14,2) NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own investments" ON public.investments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Patrimonial operations (NOT expenses — they transfer money, not spend it)
CREATE TABLE public.investment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'aporte' CHECK (type IN ('aporte','resgate','rendimento','taxa','ir')),
  amount NUMERIC(14,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own investment_transactions" ON public.investment_transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_investment_transactions_updated_at BEFORE UPDATE ON public.investment_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_investment_transactions_user ON public.investment_transactions(user_id, date);
CREATE INDEX idx_investment_transactions_investment ON public.investment_transactions(investment_id);

-- ============================================================
-- Credit Cards
-- ============================================================

CREATE TABLE public.credit_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '💳',
  color TEXT NOT NULL DEFAULT '#6366f1',
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_day INTEGER NOT NULL DEFAULT 1 CHECK (closing_day BETWEEN 1 AND 31),
  due_day INTEGER NOT NULL DEFAULT 10 CHECK (due_day BETWEEN 1 AND 31),
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own credit_cards" ON public.credit_cards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_credit_cards_updated_at BEFORE UPDATE ON public.credit_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.credit_card_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  bill_month TEXT NOT NULL, -- YYYY-MM format
  is_installment BOOLEAN NOT NULL DEFAULT false,
  installment_number INTEGER,
  total_installments INTEGER,
  installment_group_id UUID, -- shared among all installments of same purchase
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_card_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own credit_card_transactions" ON public.credit_card_transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_credit_card_transactions_updated_at BEFORE UPDATE ON public.credit_card_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cc_transactions_user ON public.credit_card_transactions(user_id);
CREATE INDEX idx_cc_transactions_card_month ON public.credit_card_transactions(credit_card_id, bill_month);

-- ============================================================
-- Transaction Classification Learning
-- ============================================================

CREATE TABLE public.transaction_classifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense','income','investment')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  investment_id UUID REFERENCES public.investments(id) ON DELETE SET NULL,
  confidence INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, keyword)
);

ALTER TABLE public.transaction_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own classifications" ON public.transaction_classifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
