import { useState, useMemo } from 'react';
import { useIncome, useExpenses, useCategories, useAccounts } from '@/hooks/useFinanceData';
import { useInvestments } from '@/hooks/useInvestments';
import { useCreditCards, useCreditCardTransactions } from '@/hooks/useCreditCards';
import { useProfile } from '@/hooks/useProfile';
import { useAccumulatedBalance } from '@/hooks/useAccumulatedBalance';
import { getMonthYear, formatCurrency, getMonthLabel } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import MonthSelector from '@/components/finance/MonthSelector';
import { Brain, Lightbulb, AlertTriangle, Trophy, Loader2, Sparkles, TrendingUp, TrendingDown, PiggyBank, Target, Zap, ShieldAlert, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export default function InsightsPage() {
  const [month, setMonth] = useState(getMonthYear());
  const prevMonth = getPrevMonth(month);
  const { data: income = [] } = useIncome(month);
  const { data: prevIncome = [] } = useIncome(prevMonth);
  const { data: expenses = [] } = useExpenses(month);
  const { data: prevExpenses = [] } = useExpenses(prevMonth);
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: investments = [] } = useInvestments();
  const { data: cards = [] } = useCreditCards();
  const { data: ccTxns = [] } = useCreditCardTransactions(undefined, month);
  const { data: profile } = useProfile();
  const { data: balance } = useAccumulatedBalance(month);
  const [aiInsights, setAiInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  // === LOCAL SMART INSIGHTS (always available, no AI needed) ===
  const localInsights = useMemo(() => {
    const insights: Insight[] = [];
    const totalIncome = income.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
    const totalExpenses = expenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
    const prevTotalIncome = prevIncome.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
    const prevTotalExpenses = prevExpenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
    const savings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;
    const investmentTotal = investments.reduce((s, i) => s + Number(i.current_value), 0);
    const patrimony = (balance || 0) + investmentTotal;

    // 1. Savings rate
    if (savingsRate >= 30) {
      insights.push({ type: 'achievement', icon: '🏆', title: 'Taxa de economia excepcional!', description: `Você está economizando ${savingsRate.toFixed(0)}% da renda — acima dos 30% recomendados. Continue assim!` });
    } else if (savingsRate >= 15) {
      insights.push({ type: 'tip', icon: '👍', title: 'Economia saudável', description: `Sua taxa de economia é de ${savingsRate.toFixed(0)}%. O ideal é 30%+. Faltam ${formatCurrency(totalIncome * 0.3 - savings)} para chegar lá.` });
    } else if (savingsRate > 0) {
      insights.push({ type: 'warning', icon: '⚠️', title: 'Economia abaixo do ideal', description: `Sua taxa de economia é apenas ${savingsRate.toFixed(0)}%. Tente reduzir gastos variáveis para atingir pelo menos 20%.` });
    } else if (totalIncome > 0) {
      insights.push({ type: 'warning', icon: '🚨', title: 'Saldo negativo no mês', description: `Você gastou ${formatCurrency(Math.abs(savings))} a mais do que ganhou. Isso é insustentável — revise gastos desnecessários.` });
    }

    // 2. Month-over-month comparison
    if (prevTotalExpenses > 0 && totalExpenses > 0) {
      const expDiff = ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100;
      if (expDiff > 15) {
        insights.push({ type: 'warning', icon: '📈', title: `Gastos subiram ${expDiff.toFixed(0)}%`, description: `Seus gastos aumentaram de ${formatCurrency(prevTotalExpenses)} para ${formatCurrency(totalExpenses)} comparado ao mês anterior. Verifique quais categorias cresceram.` });
      } else if (expDiff < -10) {
        insights.push({ type: 'achievement', icon: '📉', title: `Gastos reduziram ${Math.abs(expDiff).toFixed(0)}%`, description: `Excelente! Você reduziu gastos de ${formatCurrency(prevTotalExpenses)} para ${formatCurrency(totalExpenses)} comparado ao mês anterior.` });
      }
    }

    // 3. Category budget alerts
    const activeCategories = categories.filter(c => !c.archived && Number(c.monthly_budget) > 0);
    for (const cat of activeCategories) {
      const spent = expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0);
      const budget = Number(cat.monthly_budget);
      const pct = (spent / budget) * 100;
      if (pct > 100) {
        insights.push({ type: 'warning', icon: '🔴', title: `${cat.icon} ${cat.name}: estourou o orçamento`, description: `Você gastou ${formatCurrency(spent)} de ${formatCurrency(budget)} (${pct.toFixed(0)}%). Passou ${formatCurrency(spent - budget)} do limite.` });
      } else if (pct > 80) {
        insights.push({ type: 'tip', icon: '🟡', title: `${cat.icon} ${cat.name}: perto do limite`, description: `Já usou ${pct.toFixed(0)}% do orçamento (${formatCurrency(spent)} de ${formatCurrency(budget)}). Resta ${formatCurrency(budget - spent)}.` });
      }
    }

    // 4. Top spending category
    const catSpending = categories
      .filter(c => !c.archived)
      .map(c => ({ ...c, total: expenses.filter(e => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0) }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    if (catSpending.length > 0) {
      const top = catSpending[0];
      const pctOfTotal = totalExpenses > 0 ? (top.total / totalExpenses * 100).toFixed(0) : '0';
      insights.push({ type: 'tip', icon: '📊', title: `Maior gasto: ${top.icon} ${top.name}`, description: `Representa ${pctOfTotal}% dos seus gastos totais (${formatCurrency(top.total)}). ${Number(pctOfTotal) > 40 ? 'Está concentrado demais nessa categoria.' : ''}` });
    }

    // 5. Patrimony insight
    if (investmentTotal > 0) {
      const investedTotal = investments.reduce((s, i) => s + Number(i.total_invested), 0);
      const returnPct = investedTotal > 0 ? ((investmentTotal - investedTotal) / investedTotal * 100).toFixed(2) : '0';
      insights.push({ type: 'tip', icon: '💰', title: `Patrimônio investido: ${formatCurrency(investmentTotal)}`, description: `Rendimento total de ${returnPct}% sobre o investido. ${Number(returnPct) > 0 ? 'Seu dinheiro está trabalhando por você!' : 'Considere diversificar seus investimentos.'}` });
    }

    // 6. Credit card usage
    const ccTotal = ccTxns.reduce((s, t) => s + Number(t.amount), 0);
    if (ccTotal > 0 && totalIncome > 0) {
      const ccPct = (ccTotal / totalIncome) * 100;
      if (ccPct > 50) {
        insights.push({ type: 'warning', icon: '💳', title: 'Alto uso de cartão de crédito', description: `Fatura de ${formatCurrency(ccTotal)} representa ${ccPct.toFixed(0)}% da sua renda. Cuidado com juros e parcelamentos!` });
      }
    }

    // 7. Pending items warning
    const pendingIncome = income.filter(i => i.status === 'pendente').length;
    const pendingExpenses = expenses.filter(e => e.status === 'pendente').length;
    if (pendingIncome > 0 || pendingExpenses > 0) {
      insights.push({ type: 'tip', icon: '⏳', title: 'Transações pendentes', description: `Você tem ${pendingIncome > 0 ? `${pendingIncome} receita(s)` : ''}${pendingIncome && pendingExpenses ? ' e ' : ''}${pendingExpenses > 0 ? `${pendingExpenses} despesa(s)` : ''} pendentes. Atualize o status conforme receber/pagar.` });
    }

    // 8. Emergency fund check
    if (balance && totalExpenses > 0) {
      const monthsCovered = balance / totalExpenses;
      if (monthsCovered >= 6) {
        insights.push({ type: 'achievement', icon: '🛡️', title: 'Reserva de emergência sólida', description: `Seu saldo cobre ${monthsCovered.toFixed(1)} meses de gastos. Acima das 6 meses recomendados!` });
      } else if (monthsCovered >= 3) {
        insights.push({ type: 'tip', icon: '🛡️', title: 'Reserve de emergência razoável', description: `Seu saldo cobre ${monthsCovered.toFixed(1)} meses. Tente chegar a 6 meses de gastos (${formatCurrency(totalExpenses * 6)}).` });
      } else if (monthsCovered > 0) {
        insights.push({ type: 'warning', icon: '🛡️', title: 'Reserva de emergência insuficiente', description: `Seu saldo cobre apenas ${monthsCovered.toFixed(1)} meses de gastos. O ideal são 6 meses (${formatCurrency(totalExpenses * 6)}).` });
      }
    }

    return insights;
  }, [income, expenses, prevIncome, prevExpenses, categories, investments, ccTxns, balance, profile]);

  // === AI INSIGHTS (enhanced) ===
  const generateAiInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('financial-insights', {
        body: {
          income: income.map(i => ({ amount: i.amount, status: i.status, description: i.description, date: i.date })),
          expenses: expenses.map(e => ({ amount: e.amount, status: e.status, category_id: e.category_id, description: e.description, date: e.date })),
          categories: categories.filter(c => !c.archived).map(c => ({ id: c.id, name: c.name, icon: c.icon, monthly_budget: c.monthly_budget })),
          profile: profile ? { monthly_salary: profile.monthly_salary } : null,
          investments: investments.map(i => ({ name: i.name, type: i.type, current_value: i.current_value, total_invested: i.total_invested })),
          month_label: getMonthLabel(month),
        },
      });

      if (error) throw error;
      if (data?.error === 'rate_limited') { toast.error('Muitas requisições. Tente novamente em alguns segundos.'); return; }
      if (data?.error === 'payment_required') { toast.error('Créditos insuficientes para gerar insights.'); return; }

      setAiInsights(data?.insights || []);
      setGenerated(true);
    } catch (err) {
      const error = err as Error;
      toast.error('Erro ao gerar insights: ' + (error.message || 'Tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  const typeConfig = {
    tip: { icon: <Lightbulb className="w-4 h-4" />, bg: 'bg-primary/5 border-primary/20', text: 'text-primary', label: 'Dica' },
    warning: { icon: <AlertTriangle className="w-4 h-4" />, bg: 'bg-warning/5 border-warning/20', text: 'text-warning', label: 'Atenção' },
    achievement: { icon: <Trophy className="w-4 h-4" />, bg: 'bg-income/5 border-income/20', text: 'text-income', label: 'Conquista' },
  };

  const totalIncome = income.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
  const investmentTotal = investments.reduce((s, i) => s + Number(i.current_value), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Insights Financeiros</h1>
          <p className="text-sm text-muted-foreground">Análise inteligente dos seus dados — personalizada e prática</p>
        </div>
        <MonthSelector month={month} onChange={(m) => { setMonth(m); setGenerated(false); }} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-income" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Receitas</span>
          </div>
          <p className="text-lg font-bold text-income currency">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="stat-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-expense" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Despesas</span>
          </div>
          <p className="text-lg font-bold text-expense currency">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="stat-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Economia</span>
          </div>
          <p className={`text-lg font-bold currency ${totalIncome - totalExpenses >= 0 ? 'text-income' : 'text-expense'}`}>
            {formatCurrency(totalIncome - totalExpenses)}
          </p>
        </div>
        <div className="stat-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Patrimônio</span>
          </div>
          <p className="text-lg font-bold text-primary currency">{formatCurrency((balance || 0) + investmentTotal)}</p>
        </div>
      </div>

      {/* Local insights (always available) */}
      {localInsights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning" />
            Análise Automática
            <span className="text-xs text-muted-foreground font-normal">— baseada nos seus dados reais</span>
          </h2>
          {localInsights.map((insight, i) => {
            const config = typeConfig[insight.type] || typeConfig.tip;
            return (
              <div key={i} className={`rounded-xl border p-4 transition-all hover:shadow-sm ${config.bg}`}>
                <div className="flex items-start gap-3">
                  <span className="text-lg shrink-0">{insight.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-semibold">{insight.title}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${config.bg} ${config.text}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Insights section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          Consultoria IA
          <span className="text-xs text-muted-foreground font-normal">— recomendações avançadas com inteligência artificial</span>
        </h2>

        {!generated ? (
          <div className="stat-card flex flex-col items-center justify-center py-10 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-sm">Análise profunda com IA</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Nossa IA analisa padrões nos seus gastos, compara meses e sugere ações personalizadas para otimizar suas finanças.
              </p>
            </div>
            <Button onClick={generateAiInsights} disabled={loading} className="gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Analisando...</> : <><Sparkles className="w-4 h-4" />Gerar Consultoria IA</>}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {aiInsights.map((insight, i) => {
              const config = typeConfig[insight.type] || typeConfig.tip;
              return (
                <div key={i} className={`rounded-xl border p-4 transition-all hover:shadow-sm ${config.bg}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0">{insight.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {aiInsights.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Nenhum insight gerado. Adicione mais transações e tente novamente.
              </div>
            )}
            <Button variant="outline" onClick={generateAiInsights} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Gerar Novos Insights
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
