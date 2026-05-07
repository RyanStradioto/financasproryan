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

// ---- Category keyword mapping for AI auto-categorization
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'alimentação': ['mercado', 'supermercado', 'padaria', 'restaurante', 'lanchonete', 'ifood', 'rappi', 'uber eats', 'pizza', 'burger', 'mcdonald', 'subway', 'starbucks', 'cafe', 'café', 'açougue', 'hortifruti', 'feira', 'almoço', 'almoco', 'jantar', 'refeição', 'refeicao', 'alimentacao', 'comida', 'delivery', 'sushi', 'churrasco', 'bar ', 'boteco', 'pao de acucar', 'carrefour', 'atacadao', 'assai', 'big', 'extra', 'dia', 'sams club', 'costco'],
  'transporte': ['uber', 'lyft', '99', '99pop', 'cabify', 'gasolina', 'combustível', 'combustivel', 'estacionamento', 'pedágio', 'pedagio', 'posto', 'shell', 'ipiranga', 'br distribuidora', 'ônibus', 'onibus', 'metrô', 'metro', 'trem', 'passagem', 'bilhete', 'recarga transporte', 'sem parar', 'conectcar', 'veloe', 'move', 'bike', 'patinete'],
  'moradia': ['aluguel', 'condomínio', 'condominio', 'iptu', 'luz', 'energia', 'enel', 'cemig', 'copel', 'cpfl', 'eletropaulo', 'água', 'agua', 'sabesp', 'copasa', 'sanepar', 'gás', 'gas', 'comgas', 'manutenção', 'manutencao', 'reforma', 'pintura', 'encanador', 'eletricista'],
  'saúde': ['farmácia', 'farmacia', 'drogaria', 'droga raia', 'drogasil', 'pague menos', 'médico', 'medico', 'consulta', 'exame', 'hospital', 'clínica', 'clinica', 'dentista', 'ortodontista', 'fisioterapia', 'psicólogo', 'psicologo', 'terapia', 'cirurgia', 'plano de saude', 'plano de saúde', 'unimed', 'amil', 'sulamerica', 'bradesco saude', 'hapvida', 'notre dame'],
  'educação': ['escola', 'faculdade', 'universidade', 'curso', 'udemy', 'coursera', 'alura', 'rocketseat', 'livro', 'livraria', 'material escolar', 'mensalidade', 'matrícula', 'matricula', 'apostila'],
  'lazer': ['cinema', 'netflix', 'spotify', 'disney', 'hbo', 'amazon prime', 'globoplay', 'deezer', 'youtube', 'twitch', 'steam', 'playstation', 'xbox', 'nintendo', 'jogo', 'game', 'ingresso', 'teatro', 'show', 'concerto', 'parque', 'viagem', 'hotel', 'airbnb', 'booking', 'passeio'],
  'vestuário': ['roupa', 'calçado', 'calcado', 'sapato', 'tênis', 'tenis', 'camisa', 'calça', 'calca', 'vestido', 'shein', 'renner', 'riachuelo', 'c&a', 'zara', 'hering', 'marisa', 'centauro', 'netshoes', 'magazine luiza', 'magalu'],
  'assinaturas': ['assinatura', 'mensalidade', 'plano', 'premium', 'pro', 'plus', 'vip', 'icloud', 'google one', 'dropbox', 'adobe', 'microsoft', 'office', 'chatgpt', 'openai'],
  'telecomunicações': ['telefone', 'celular', 'internet', 'wifi', 'vivo', 'claro', 'tim', 'oi', 'net', 'sky', 'fibra'],
  'pets': ['pet', 'veterinário', 'veterinario', 'ração', 'racao', 'petshop', 'pet shop', 'petz', 'cobasi'],
  'seguros': ['seguro', 'porto seguro', 'bradesco seguros', 'itau seguros', 'liberty', 'tokio marine', 'zurich', 'mapfre', 'azul seguros'],
};

// ---- Result types
export type ClassificationType = 'expense' | 'income' | 'investment';
export type ClassificationConfidence = 'high' | 'medium' | 'low';

export interface ClassificationRule {
  keyword: string;
  type: string;
  category_id: string | null;
  investment_id: string | null;
}

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
  userRules: ClassificationRule[] = [],
  categories: Array<{ id: string; name: string }> = []
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

  // 4. AI category detection — match description to category keywords, then find user category
  if (categories.length > 0) {
    for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          const catNameNorm = catName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const matchedCat = categories.find(c =>
            c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(catNameNorm) ||
            catNameNorm.includes(c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
          );
          if (matchedCat) {
            return {
              type: amount > 0 ? 'income' : 'expense',
              confidence: 'high',
              categoryId: matchedCat.id,
              reason: `IA: "${kw}" → ${matchedCat.name}`,
            };
          }
        }
      }
    }
  }

  // 5. Amount sign heuristic (default)
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
