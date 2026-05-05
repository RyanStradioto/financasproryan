import { useState, useMemo } from 'react';
import { useIncome, useExpenses, useCategories } from '@/hooks/useFinanceData';
import { useInvestments } from '@/hooks/useInvestments';
import { useCreditCards, useCreditCardTransactions } from '@/hooks/useCreditCards';
import { useProfile } from '@/hooks/useProfile';
import { useAccumulatedBalance } from '@/hooks/useAccumulatedBalance';
import { getMonthYear, formatCurrency, getMonthLabel } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import MonthSelector from '@/components/finance/MonthSelector';
import {
  Brain, Lightbulb, AlertTriangle, Trophy, Loader2, Sparkles,
  TrendingUp, TrendingDown, PiggyBank, ChevronDown, ChevronUp,
  BarChart3, Wallet, Wand2, RefreshCw, Heart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Insight = {
  icon: string;
  title: string;
  description: string;
  type: 'tip' | 'warning' | 'achievement';
};

function getPrevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const TYPE_CONFIG = {
  tip: {
    icon: Lightbulb,
    label: 'Dica',
    accent: 'hsl(217, 91%, 60%)', // info
    border: 'border-info/30',
    bg: 'bg-info/[0.06]',
    text: 'text-info',
    chipBg: 'bg-info/15',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Atenção',
    accent: 'hsl(38, 92%, 50%)', // warning
    border: 'border-warning/30',
    bg: 'bg-warning/[0.06]',
    text: 'text-warning',
    chipBg: 'bg-warning/15',
  },
  achievement: {
    icon: Trophy,
    label: 'Conquista',
    accent: 'hsl(160, 84%, 39%)', // income
    border: 'border-income/30',
    bg: 'bg-income/[0.06]',
    text: 'text-income',
    chipBg: 'bg-income/15',
  },
};

function InsightCard({ insight }: { insight: Insight }) {
  const cfg = TYPE_CONFIG[insight.type] || TYPE_CONFIG.tip;
  const Icon = cfg.icon;
  return (
    <div className={cn('group relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all hover:shadow-md', cfg.border, cfg.bg)}>
      <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-[0.08] group-hover:opacity-[0.14] transition-opacity pointer-events-none" style={{ background: `radial-gradient(circle, ${cfg.accent} 0%, transparent 70%)` }} />
      <div className="relative z-10 flex items-start gap-3.5">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl', cfg.chipBg)}>
          {insight.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-bold leading-tight">{insight.title}</h4>
            <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider', cfg.chipBg, cfg.text)}>
              <Icon className="w-2.5 h-2.5" />
              {cfg.label}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{insight.description}</p>
        </div>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const [month, setMonth] = useState(getMonthYear());
  const [showAutomaticInsights, setShowAutomaticInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const prevMonth = getPrevMonth(month);
  const { data: income = [] } = useIncome(month);
  const { data: prevIncome = [] } = useIncome(prevMonth);
  const { data: expenses = [] } = useExpenses(month);
  const { data: prevExpenses = [] } = useExpenses(prevMonth);
  const { data: categories = [] } = useCategories();
  const { data: investments = [] } = useInvestments();
  const { data: cards = [] } = useCreditCards();
  const { data: ccTxns = [] } = useCreditCardTransactions(undefined, month);
  const { data: profile } = useProfile();
  const { data: balance } = useAccumulatedBalance(month);

  const totalIncome = useMemo(() => income.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0), [income]);
  const totalExpenses = useMemo(() => expenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const investmentTotal = useMemo(() => investments.reduce((s, i) => s + Number(i.current_value), 0), [investments]);
  const ccTotal = useMemo(() => ccTxns.reduce((s, t) => s + Number(t.amount), 0), [ccTxns]);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const netWorth = (balance || 0) + investmentTotal;

  const localInsights = useMemo(() => {
    const insights: Insight[] = [];
    const prevTotalExpenses = prevExpenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
    const prevTotalIncome = prevIncome.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
    const savings = totalIncome - totalExpenses;

    if (savingsRate >= 30) {
      insights.push({ type: 'achievement', icon: '🏆', title: 'Taxa de economia excepcional', description: `Você está economizando ${savingsRate.toFixed(0)}% da sua renda — bem acima da média recomendada de 20%.` });
    } else if (savingsRate >= 15) {
      insights.push({ type: 'tip', icon: '👍', title: 'Economia saudável', description: `Sua taxa de economia é de ${savingsRate.toFixed(0)}%. Tente subir gradualmente até 20-30% para acelerar metas.` });
    } else if (savingsRate > 0) {
      insights.push({ type: 'warning', icon: '⚠️', title: 'Economia abaixo do ideal', description: `Sua taxa de economia está em ${savingsRate.toFixed(0)}%. Revise os maiores gastos do mês para ganhar fôlego.` });
    }

    if (prevTotalExpenses > 0 && totalExpenses > 0) {
      const expDiff = ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100;
      if (expDiff > 15) {
        insights.push({ type: 'warning', icon: '📈', title: `Gastos subiram ${expDiff.toFixed(0)}%`, description: `Passaram de ${formatCurrency(prevTotalExpenses)} para ${formatCurrency(totalExpenses)} em relação ao mês anterior.` });
      } else if (expDiff < -10) {
        insights.push({ type: 'achievement', icon: '📉', title: `Gastos reduziram ${Math.abs(expDiff).toFixed(0)}%`, description: `Caíram de ${formatCurrency(prevTotalExpenses)} para ${formatCurrency(totalExpenses)} — ótimo trabalho de controle!` });
      }
    }

    if (prevTotalIncome > 0 && totalIncome > 0) {
      const incDiff = ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100;
      if (incDiff > 10) {
        insights.push({ type: 'achievement', icon: '💸', title: `Receita aumentou ${incDiff.toFixed(0)}%`, description: `Passou de ${formatCurrency(prevTotalIncome)} para ${formatCurrency(totalIncome)}.` });
      }
    }

    const activeCategories = categories.filter(c => !c.archived && Number(c.monthly_budget) > 0);
    for (const cat of activeCategories) {
      const spent = expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0);
      const budget = Number(cat.monthly_budget);
      const pct = (spent / budget) * 100;
      if (pct > 100) {
        insights.push({ type: 'warning', icon: '🔴', title: `${cat.icon} ${cat.name}: estourou o orçamento`, description: `Gastou ${formatCurrency(spent)} de ${formatCurrency(budget)} — ${(pct - 100).toFixed(0)}% acima do limite.` });
      } else if (pct > 80) {
        insights.push({ type: 'tip', icon: '🟡', title: `${cat.icon} ${cat.name}: perto do limite`, description: `Já usou ${pct.toFixed(0)}% do orçamento. Restam ${formatCurrency(budget - spent)}.` });
      }
    }

    const catSpending = categories
      .filter(c => !c.archived)
      .map(c => ({ ...c, total: expenses.filter(e => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0) }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    if (catSpending.length > 0) {
      const top = catSpending[0];
      const pctOfTotal = totalExpenses > 0 ? (top.total / totalExpenses * 100).toFixed(0) : '0';
      insights.push({ type: 'tip', icon: '📊', title: `Maior categoria: ${top.icon} ${top.name}`, description: `Representa ${pctOfTotal}% dos gastos do mês (${formatCurrency(top.total)}).` });
    }

    if (investmentTotal > 0) {
      const investedTotal = investments.reduce((s, i) => s + Number(i.total_invested), 0);
      const returnPct = investedTotal > 0 ? ((investmentTotal - investedTotal) / investedTotal * 100) : 0;
      if (returnPct > 0) {
        insights.push({ type: 'achievement', icon: '💰', title: 'Investimentos rendendo', description: `Patrimônio em investimentos cresceu ${returnPct.toFixed(2)}% sobre o aportado (${formatCurrency(investmentTotal - investedTotal)} de ganho).` });
      } else if (returnPct < -5) {
        insights.push({ type: 'warning', icon: '📉', title: 'Investimentos em prejuízo', description: `Carteira está ${Math.abs(returnPct).toFixed(2)}% abaixo do investido — revise alocações se necessário.` });
      }
    }

    if (ccTotal > 0 && totalIncome > 0) {
      const ccPct = (ccTotal / totalIncome) * 100;
      if (ccPct > 50) {
        insights.push({ type: 'warning', icon: '💳', title: 'Alto uso do cartão de crédito', description: `Fatura de ${formatCurrency(ccTotal)} representa ${ccPct.toFixed(0)}% da sua renda. Cuidado com o efeito bola de neve.` });
      } else if (ccPct < 20 && ccTotal > 0) {
        insights.push({ type: 'tip', icon: '💳', title: 'Uso saudável do cartão', description: `Fatura representa apenas ${ccPct.toFixed(0)}% da renda — controle excelente.` });
      }
    }

    if (balance && totalExpenses > 0) {
      const monthsCovered = balance / totalExpenses;
      if (monthsCovered < 3) {
        insights.push({ type: 'warning', icon: '🛡️', title: 'Reserva de emergência insuficiente', description: `Saldo cobre ${monthsCovered.toFixed(1)} meses de gastos. O ideal é ter 3-6 meses guardados.` });
      } else if (monthsCovered >= 6) {
        insights.push({ type: 'achievement', icon: '🛡️', title: 'Reserva sólida', description: `Você tem ${monthsCovered.toFixed(1)} meses de gastos guardados — proteção financeira excelente.` });
      }
    }

    if (savings < 0) {
      insights.push({ type: 'warning', icon: '🚨', title: 'Você gastou mais do que ganhou', description: `Déficit de ${formatCurrency(Math.abs(savings))} no mês. Revise gastos não essenciais com urgência.` });
    }

    return insights.slice(0, 10);
  }, [income, expenses, prevIncome, prevExpenses, categories, investments, ccTotal, balance, savingsRate, totalIncome, totalExpenses, investmentTotal]);

  const insightCounts = useMemo(() => ({
    achievement: localInsights.filter(i => i.type === 'achievement').length,
    tip: localInsights.filter(i => i.type === 'tip').length,
    warning: localInsights.filter(i => i.type === 'warning').length,
  }), [localInsights]);

  const generateAiInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('financial-insights', {
        body: {
          income: income.map(i => ({ amount: i.amount, status: i.status, description: i.description, date: i.date })),
          expenses: expenses.map(e => ({ amount: e.amount, status: e.status, category_id: e.category_id, description: e.description, date: e.date, notes: e.notes })),
          prev_income: prevIncome.map(i => ({ amount: i.amount, status: i.status, description: i.description, date: i.date })),
          prev_expenses: prevExpenses.map(e => ({ amount: e.amount, status: e.status, category_id: e.category_id, description: e.description, date: e.date, notes: e.notes })),
          cc_transactions: ccTxns.map(t => ({ amount: t.amount, category_id: t.category_id, description: t.description, date: t.date, bill_month: t.bill_month })),
          categories: categories.filter(c => !c.archived).map(c => ({ id: c.id, name: c.name, icon: c.icon, monthly_budget: c.monthly_budget })),
          profile: profile ? { monthly_salary: profile.monthly_salary } : null,
          investments: investments.map(i => ({ name: i.name, type: i.type, current_value: i.current_value, total_invested: i.total_invested })),
          month_label: getMonthLabel(month),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAiInsights(data?.insights || []);
      setGenerated(true);
    } catch (err) {
      const error = err as Error;
      toast.error('Erro ao gerar insights: ' + (error.message || 'Tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.06] p-4 shadow-sm sm:rounded-3xl sm:p-7">
        <div className="absolute -top-24 -right-32 w-80 h-80 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-72 h-72 bg-info/[0.08] blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center shadow-inner border border-primary/15 shrink-0">
                <Brain className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                <Sparkles className="absolute -top-1 -right-1 w-3.5 h-3.5 text-primary/80 animate-pulse" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">Insights Financeiros</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Análise inteligente dos seus dados
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <MonthSelector month={month} onChange={(m) => { setMonth(m); setGenerated(false); setAiInsights([]); }} />
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 lg:grid-cols-4 md:gap-3">
            <div className="rounded-2xl border border-income/25 bg-income/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-income mb-0.5">
                <TrendingUp className="h-3 w-3" />
                <p className="text-[9px] font-bold uppercase tracking-wider">Receitas</p>
              </div>
              <p className="text-sm sm:text-base font-extrabold currency text-income tabular-nums whitespace-nowrap truncate">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="rounded-2xl border border-expense/25 bg-expense/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-expense mb-0.5">
                <TrendingDown className="h-3 w-3" />
                <p className="text-[9px] font-bold uppercase tracking-wider">Despesas</p>
              </div>
              <p className="text-sm sm:text-base font-extrabold currency text-expense tabular-nums whitespace-nowrap truncate">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className={cn('rounded-2xl border px-3 py-2.5', (totalIncome - totalExpenses) >= 0 ? 'border-info/25 bg-info/[0.06]' : 'border-expense/25 bg-expense/[0.06]')}>
              <div className={cn('flex items-center gap-1.5 mb-0.5', (totalIncome - totalExpenses) >= 0 ? 'text-info' : 'text-expense')}>
                <PiggyBank className="h-3 w-3" />
                <p className="text-[9px] font-bold uppercase tracking-wider">Economia</p>
              </div>
              <p className={cn('text-sm sm:text-base font-extrabold currency tabular-nums whitespace-nowrap truncate', (totalIncome - totalExpenses) >= 0 ? 'text-info' : 'text-expense')}>{formatCurrency(totalIncome - totalExpenses)}</p>
            </div>
            <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-primary mb-0.5">
                <Wallet className="h-3 w-3" />
                <p className="text-[9px] font-bold uppercase tracking-wider">Patrimônio</p>
              </div>
              <p className="text-sm sm:text-base font-extrabold currency text-primary tabular-nums whitespace-nowrap truncate">{formatCurrency(netWorth)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Consultoria IA Card (Hero CTA) ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-card p-4 shadow-sm sm:rounded-3xl sm:p-8">
        <div className="absolute -top-24 -right-20 w-72 h-72 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md shadow-primary/30">
                <Wand2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold leading-tight tracking-tight">Consultoria IA</h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Análise profunda powered by AI</p>
              </div>
            </div>
            {generated && aiInsights.length > 0 && (
              <Button onClick={generateAiInsights} disabled={loading} size="sm" variant="outline" className="gap-1.5 h-9 rounded-xl">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Regenerar
              </Button>
            )}
          </div>

          {!generated ? (
            <div className="flex flex-col items-center text-center py-6">
              <p className="text-sm text-muted-foreground max-w-md mb-5 leading-relaxed">
                Receba uma análise personalizada com recomendações específicas para sua situação financeira atual.
              </p>
              <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-center">
                <Button onClick={generateAiInsights} disabled={loading} size="lg" className="gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 rounded-xl">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Analisando seus dados...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" />Gerar Consultoria IA</>
                  )}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowAutomaticInsights(v => !v)} className="gap-2 rounded-xl">
                  {showAutomaticInsights ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showAutomaticInsights ? 'Ocultar' : 'Ver'} diagnóstico rápido
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {aiInsights.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {aiInsights.map((insight, i) => (
                    <InsightCard key={i} insight={insight} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Nenhum insight foi gerado. Tente novamente após adicionar mais transações.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Diagnóstico Automático ─── */}
      {(showAutomaticInsights || (generated && aiInsights.length === 0)) && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center border border-info/15">
                <BarChart3 className="w-4 h-4 text-info" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">Diagnóstico Automático</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Análise local instantânea — sem IA</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {insightCounts.achievement > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-income/10 border border-income/20 text-income text-[10px] font-bold">
                  <Trophy className="w-2.5 h-2.5" /> {insightCounts.achievement} conquista{insightCounts.achievement !== 1 ? 's' : ''}
                </span>
              )}
              {insightCounts.tip > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-info/10 border border-info/20 text-info text-[10px] font-bold">
                  <Lightbulb className="w-2.5 h-2.5" /> {insightCounts.tip} dica{insightCounts.tip !== 1 ? 's' : ''}
                </span>
              )}
              {insightCounts.warning > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-warning/10 border border-warning/20 text-warning text-[10px] font-bold">
                  <AlertTriangle className="w-2.5 h-2.5" /> {insightCounts.warning} alerta{insightCounts.warning !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {localInsights.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {localInsights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/50 bg-muted/10 p-10 text-center">
              <Heart className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-bold">Sem dados suficientes</p>
              <p className="text-xs text-muted-foreground mt-1">Adicione mais transações para receber insights automáticos</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
