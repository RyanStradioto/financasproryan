import { useState } from 'react';
import { useIncome, useExpenses, useCategories, useRecentDeletions, useRestoreDeletion } from '@/hooks/useFinanceData';
import { useProfile } from '@/hooks/useProfile';
import { getMonthYear } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import MonthSelector from '@/components/finance/MonthSelector';
import { Brain, Lightbulb, AlertTriangle, Trophy, Loader2, Sparkles, RotateCcw, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Insight = {
  icon: string;
  title: string;
  description: string;
  type: 'tip' | 'warning' | 'achievement';
};

export default function InsightsPage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { data: categories = [] } = useCategories();
  const { data: deletions = [] } = useRecentDeletions();
  const restoreDeletion = useRestoreDeletion();
  const { data: profile } = useProfile();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [showDeletions, setShowDeletions] = useState(true);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('financial-insights', {
        body: {
          income: income.map(i => ({ amount: i.amount, status: i.status, category_id: null })),
          expenses: expenses.map(e => ({ amount: e.amount, status: e.status, category_id: e.category_id })),
          categories: categories.filter(c => !c.archived).map(c => ({ id: c.id, name: c.name, icon: c.icon, monthly_budget: c.monthly_budget })),
          profile: profile ? { monthly_salary: profile.monthly_salary } : null,
        },
      });

      if (error) throw error;
      if (data?.error === 'rate_limited') {
        toast.error('Muitas requisições. Tente novamente em alguns segundos.');
        return;
      }
      if (data?.error === 'payment_required') {
        toast.error('Créditos insuficientes para gerar insights.');
        return;
      }

      setInsights(data?.insights || []);
      setGenerated(true);
    } catch (err) {
      const error = err as Error;
      toast.error('Erro ao gerar insights: ' + (error.message || 'Tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  const typeConfig = {
    tip: { icon: <Lightbulb className="w-5 h-5" />, bg: 'bg-primary/5 border-primary/20', text: 'text-primary' },
    warning: { icon: <AlertTriangle className="w-5 h-5" />, bg: 'bg-warning/5 border-warning/20', text: 'text-warning' },
    achievement: { icon: <Trophy className="w-5 h-5" />, bg: 'bg-income/5 border-income/20', text: 'text-income' },
  };

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      await restoreDeletion.mutateAsync(id);
      toast.success('Exclusão restaurada com sucesso.');
    } catch (err) {
      const error = err as Error;
      toast.error('Erro ao restaurar exclusão: ' + (error.message || 'Tente novamente'));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Insights Financeiros</h1>
          <p className="text-sm text-muted-foreground">Dicas personalizadas com IA baseadas nos seus dados</p>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      {!generated ? (
        <div className="stat-card flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold">Análise Inteligente</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Nossa IA analisa suas receitas, despesas, orçamentos e padrões de gastos para entregar recomendações práticas.
            </p>
          </div>
          <Button onClick={generateInsights} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Gerar Insights
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {insights.map((insight, i) => {
              const config = typeConfig[insight.type] || typeConfig.tip;
              const icon = insight.icon ? <span className="text-xl leading-none">{insight.icon}</span> : config.icon;
              return (
                <div
                  key={i}
                  className={`rounded-3xl border p-4 transition-all ${config.bg}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${config.text}`}>{icon}</div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        {insight.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-2 leading-6">{insight.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {insights.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum insight gerado. Adicione mais transações e tente novamente.
            </div>
          )}
          <Button variant="outline" onClick={generateInsights} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Gerar Novos Insights
          </Button>
        </div>
      )}
      <div className="rounded-3xl border bg-muted p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ClipboardList className="w-4 h-4" />
              Últimas Exclusões
            </div>
            <p className="text-xs text-muted-foreground mt-1">Registros removidos nos últimos 30 dias podem ser restaurados com um clique.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowDeletions(prev => !prev)}>
            {showDeletions ? 'Ocultar histórico' : 'Mostrar histórico'}
          </Button>
        </div>
        {showDeletions && (
          <div className="mt-4 space-y-3">
            {deletions.length === 0 ? (
              <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                Nenhuma exclusão recente encontrada. As entradas apagadas são mantidas por 30 dias.
              </div>
            ) : (
              deletions.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold text-foreground">{item.table_name === 'income' ? 'Receita' : 'Despesa'} removida</div>
                    <div className="text-muted-foreground">ID: {item.record_id}</div>
                    <div className="text-muted-foreground">Removido em {new Date(item.deleted_at).toLocaleString('pt-BR')}</div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRestore(item.id)}
                    disabled={restoringId === item.id}
                  >
                    {restoringId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Desfazer
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
