import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// ---- Built-in investment keywords (always treated as patrimonial, NEVER as expense)
const INVESTMENT_KEYWORDS = [
  'aplicação', 'aplicacao', 'aporte', 'corretora', 'caixinha',
  'poupança', 'poupanca', 'cdb', 'lci', 'lca', 'tesouro',
  'fundo', 'fii', 'ação', 'acao', 'acoes', 'ações',
  'nuinvest', 'xp investimentos', 'btg', 'rico', 'clear',
  'inter invest', 'itaú invest', 'genial', 'warren', 'vitreo',
  'transferência investimento', 'transferencia investimento',
  'rendimento', 'dividendo', 'jcp', 'bitcoin', 'ethereum', 'cripto',
];

// ---- Built-in income keywords
const INCOME_KEYWORDS = [
  'salário', 'salario', 'ordenado', 'pagamento recebido', 'freelance',
  'pix recebido', 'transferência recebida', 'reembolso', 'restituição',
  'dividendo', 'rendimento recebido', 'cashback',
];

// ---- Result types
export type ClassificationType = 'expense' | 'income' | 'investment';
export type ClassificationConfidence = 'high' | 'medium' | 'low';

export interface ClassificationResult {
  type: ClassificationType;
  confidence: ClassificationConfidence;
  categoryId?: string;
  investmentId?: string;
  reason: string;
}

/** Pure classification function — no Supabase needed */
export function classifyDescription(
  description: string,
  amount: number,
  userRules: Array<{ keyword: string; type: string; category_id: string | null; investment_id: string | null }> = []
): ClassificationResult {
  const lower = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. User-defined rules (highest priority)
  for (const rule of userRules) {
    const kw = rule.keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(kw)) {
      return {
        type: rule.type as ClassificationType,
        confidence: 'high',
        categoryId: rule.category_id ?? undefined,
        investmentId: rule.investment_id ?? undefined,
        reason: `Regra do usuário: "${rule.keyword}"`,
      };
    }
  }

  // 2. Built-in investment detection (CRITICAL rule: never expense)
  for (const kw of INVESTMENT_KEYWORDS) {
    if (lower.includes(kw)) {
      return {
        type: 'investment',
        confidence: 'high',
        reason: `Palavra-chave de investimento: "${kw}"`,
      };
    }
  }

  // 3. Built-in income detection
  if (amount > 0) {
    for (const kw of INCOME_KEYWORDS) {
      if (lower.includes(kw)) {
        return {
          type: 'income',
          confidence: 'high',
          reason: `Palavra-chave de receita: "${kw}"`,
        };
      }
    }
  }

  // 4. Amount sign heuristic (default)
  // Positive = income, negative = expense (Nubank convention)
  if (amount > 0) {
    return { type: 'income', confidence: 'medium', reason: 'Valor positivo' };
  }
  return { type: 'expense', confidence: 'medium', reason: 'Valor negativo' };
}

/** React hook to get user classification rules from Supabase */
export function useClassificationRules() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['classification-rules', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_classifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

/** Save a user-defined rule (keyword → type/category) */
export function useSaveClassificationRule() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (rule: {
      keyword: string;
      type: ClassificationType;
      category_id?: string | null;
      investment_id?: string | null;
    }) => {
      const { error } = await supabase
        .from('transaction_classifications')
        .upsert({
          user_id: user!.id,
          keyword: rule.keyword.toLowerCase(),
          type: rule.type,
          category_id: rule.category_id ?? null,
          investment_id: rule.investment_id ?? null,
          confidence: 100,
        }, { onConflict: 'user_id,keyword' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classification-rules'] }),
  });
}
