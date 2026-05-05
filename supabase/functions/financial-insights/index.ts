import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Item = {
  amount: number;
  status?: string;
  category_id?: string | null;
  description?: string;
  date?: string;
};

type Category = {
  id: string;
  name: string;
  icon?: string | null;
  monthly_budget?: number | null;
};

type Insight = {
  icon: string;
  title: string;
  description: string;
  type: "tip" | "warning" | "achievement";
};

const fmt = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function buildDeterministicInsights(params: {
  income: Item[];
  expenses: Item[];
  categories: Category[];
  profile?: { monthly_salary?: number | null } | null;
  monthLabel?: string;
}): Insight[] {
  const totalIncome = params.income
    .filter((item) => item.status === "concluido")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const totalExpenses = params.expenses
    .filter((item) => item.status === "concluido")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

  const categoryBreakdown = params.categories
    .map((category) => {
      const spent = params.expenses
        .filter((expense) => expense.status === "concluido" && expense.category_id === category.id)
        .reduce((sum, expense) => sum + Number(expense.amount), 0);
      return {
        ...category,
        spent,
        percent: totalExpenses > 0 ? (spent / totalExpenses) * 100 : 0,
      };
    })
    .filter((category) => category.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  const insights: Insight[] = [];
  const topCategory = categoryBreakdown[0];

  if (topCategory) {
    const cut10 = topCategory.spent * 0.1;
    insights.push({
      icon: "📊",
      title: `Maior gasto em ${topCategory.name}`,
      description: `${topCategory.icon ?? ""} ${topCategory.name} representa ${topCategory.percent.toFixed(0)}% das despesas de ${params.monthLabel ?? "este mês"} (${fmt(topCategory.spent)}). Cortando 10%, você economiza ${fmt(cut10)}.`,
      type: topCategory.percent >= 40 ? "warning" : "tip",
    });
  }

  const overBudget = categoryBreakdown.find((category) => Number(category.monthly_budget) > 0 && category.spent > Number(category.monthly_budget));
  if (overBudget) {
    const exceeded = overBudget.spent - Number(overBudget.monthly_budget);
    insights.push({
      icon: "🎯",
      title: `${overBudget.name} acima do orçamento`,
      description: `Você passou ${fmt(exceeded)} do orçamento de ${fmt(Number(overBudget.monthly_budget))} em ${overBudget.name}. Se cortar esse excesso no próximo ciclo, sua sobra mensal melhora no mesmo valor.`,
      type: "warning",
    });
  }

  if (totalIncome > 0 && savingsRate < 20) {
    const targetSavings = totalIncome * 0.2;
    const missing = targetSavings - Math.max(balance, 0);
    insights.push({
      icon: "💡",
      title: "Meta de poupança abaixo do ideal",
      description: `Sua taxa de poupança ficou em ${savingsRate.toFixed(1)}%. Para chegar a 20%, falta preservar ${fmt(Math.max(missing, 0))} no mês.`,
      type: "tip",
    });
  } else if (totalIncome > 0) {
    insights.push({
      icon: "🏆",
      title: "Poupança em bom nível",
      description: `Você poupou ${savingsRate.toFixed(1)}% da renda em ${params.monthLabel ?? "este mês"}. Mantendo esse ritmo, acumula ${fmt(Math.max(balance, 0) * 6)} em 6 meses.`,
      type: "achievement",
    });
  }

  if (balance < 0) {
    insights.push({
      icon: "🚨",
      title: "Mês no negativo",
      description: `As despesas superaram as receitas em ${fmt(Math.abs(balance))}. Priorize reduzir a maior categoria de gasto para reequilibrar o próximo mês.`,
      type: "warning",
    });
  } else {
    insights.push({
      icon: "📈",
      title: "Projeção de saldo",
      description: `Mantendo a sobra atual de ${fmt(balance)}, você acumula ${fmt(balance * 3)} em 3 meses e ${fmt(balance * 12)} em 12 meses.`,
      type: "achievement",
    });
  }

  const salary = Number(params.profile?.monthly_salary || 0);
  if (salary > 0 && totalExpenses > 0) {
    const expenseShare = (totalExpenses / salary) * 100;
    insights.push({
      icon: "🧠",
      title: "Leitura da renda comprometida",
      description: `Os gastos do mês consumiram ${expenseShare.toFixed(1)}% do seu salário informado (${fmt(salary)}). ${expenseShare > 80 ? "Esse nível pede atenção." : "O nível está administrável."}`,
      type: expenseShare > 80 ? "warning" : "tip",
    });
  }

  return insights.slice(0, 5);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      income = [],
      expenses = [],
      prev_income = [],
      prev_expenses = [],
      categories = [],
      profile = null,
      investments = [],
      cc_transactions = [],
      month_label = "este mês",
    } = await req.json();
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const fallbackInsights = buildDeterministicInsights({
      income,
      expenses,
      categories,
      profile,
      monthLabel: month_label,
    });

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ insights: fallbackInsights, source: "local-fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build a rich, specific data summary for the AI ───────────────
    const totalIncome = income.filter((i: Item) => i.status === "concluido").reduce((s: number, i: Item) => s + Number(i.amount), 0);
    const totalExpensesPaid = expenses.filter((e: Item) => e.status === "concluido").reduce((s: number, e: Item) => s + Number(e.amount), 0);
    const totalCC = cc_transactions.reduce((s: number, t: Record<string, unknown>) => s + Number(t.amount), 0);
    const totalExpenses = totalExpensesPaid + totalCC;
    const balance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;

    // Previous month comparisons
    const prevTotalIncome = prev_income.filter((i: Item) => i.status === "concluido").reduce((s: number, i: Item) => s + Number(i.amount), 0);
    const prevTotalExpenses = prev_expenses.filter((e: Item) => e.status === "concluido").reduce((s: number, e: Item) => s + Number(e.amount), 0);
    const incomeMoM = prevTotalIncome > 0 ? ((totalIncome - prevTotalIncome) / prevTotalIncome * 100) : null;
    const expenseMoM = prevTotalExpenses > 0 ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses * 100) : null;

    const today = new Date();
    const dayOfMonth = today.getDate();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dailyAvg = dayOfMonth > 0 ? totalExpenses / dayOfMonth : 0;
    const projectedMonthEnd = dailyAvg * lastDayOfMonth;

    // Top 5 individual expenses + CC purchases
    const allMovements = [
      ...expenses.filter((e: Item) => e.status === "concluido").map((e: Item) => ({ ...e, source: "exp" })),
      ...cc_transactions.map((t: Record<string, unknown>) => ({ ...t, source: "cc" })),
    ].sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.amount) - Number(a.amount)).slice(0, 5);

    const categoryMetrics = categories.map((c: Category) => {
      const fromExp = expenses.filter((e: Item) => e.status === "concluido" && e.category_id === c.id).reduce((s: number, e: Item) => s + Number(e.amount), 0);
      const fromCC = cc_transactions.filter((t: Record<string, unknown>) => t.category_id === c.id).reduce((s: number, t: Record<string, unknown>) => s + Number(t.amount), 0);
      const spent = fromExp + fromCC;
      const budget = Number(c.monthly_budget) || 0;
      const overBy = budget > 0 && spent > budget ? spent - budget : 0;
      return { name: c.name, icon: c.icon, spent, budget, overBy, pct: totalExpenses > 0 ? (spent / totalExpenses * 100) : 0 };
    }).filter((c: Record<string, number>) => Number(c.spent) > 0).sort((a, b) => Number(b.spent) - Number(a.spent));

    // Investment summary
    const invCurrent = investments.reduce((s: number, i: Record<string, unknown>) => s + Number(i.current_value || 0), 0);
    const invInvested = investments.reduce((s: number, i: Record<string, unknown>) => s + Number(i.total_invested || 0), 0);
    const invReturn = invInvested > 0 ? ((invCurrent - invInvested) / invInvested * 100) : 0;

    const salary = Number(profile?.monthly_salary || 0);
    const reservaMeses = totalExpenses > 0 ? invCurrent / totalExpenses : 0;

    const prompt = `Você é um consultor financeiro pessoal experiente, direto e que trabalha com NÚMEROS REAIS, não com generalidades. Gere 6 a 8 insights ESPECÍFICOS, ACIONÁVEIS e PERSONALIZADOS para o mês de ${month_label}.

REGRAS CRÍTICAS:
- NÃO use frases genéricas tipo "controle seus gastos", "economize mais", "revise seu orçamento". TODA recomendação deve citar valores em R$ e categorias específicas.
- TODA descrição deve ter pelo menos UM número concreto (R$, %, dias, meses).
- Misture os 3 tipos: warning, tip, achievement. Pelo menos 1 de cada se aplicável.
- Use linguagem coloquial brasileira, segunda pessoa ("você"), sem jargão.
- Seja específico em ações: "corte X% em Y categoria por 3 meses para juntar Z" em vez de "reduza gastos".
- Identifique padrões e anomalias nos dados, não apenas reporte totais.

DADOS DO MÊS:
- Receita concluída: ${fmt(totalIncome)}${incomeMoM !== null ? ` (${incomeMoM > 0 ? "+" : ""}${incomeMoM.toFixed(0)}% vs mês anterior)` : ""}
- Despesa total: ${fmt(totalExpenses)}${expenseMoM !== null ? ` (${expenseMoM > 0 ? "+" : ""}${expenseMoM.toFixed(0)}% vs mês anterior)` : ""}
  - Em conta/débito/PIX: ${fmt(totalExpensesPaid)}
  - No cartão de crédito: ${fmt(totalCC)}
- Saldo: ${fmt(balance)} ${balance < 0 ? "(NEGATIVO)" : ""}
- Taxa de poupança: ${savingsRate.toFixed(1)}%
- Dia ${dayOfMonth} de ${lastDayOfMonth} do mês
- Média diária de gastos: ${fmt(dailyAvg)}
- Projeção de fechamento (se manter ritmo): ${fmt(projectedMonthEnd)}
${salary > 0 ? `- Salário declarado: ${fmt(salary)}` : ""}

CATEGORIAS (em ordem de gasto):
${categoryMetrics.slice(0, 12).map((c) => {
  return `- ${c.icon || ""} ${c.name}: ${fmt(c.spent)} (${c.pct.toFixed(0)}% do total)${c.budget > 0 ? `, orçamento ${fmt(c.budget)}${c.overBy > 0 ? ` ESTOUROU em ${fmt(c.overBy)}` : ` (${((c.spent/c.budget)*100).toFixed(0)}% usado)`}` : " (sem orçamento)"}`
}).join("\n")}

TOP 5 GASTOS INDIVIDUAIS:
${allMovements.map((m: Record<string, unknown>, i: number) => `${i + 1}. ${m.description || "(sem descrição)"} — ${fmt(Number(m.amount))} ${m.source === "cc" ? "[CARTÃO]" : "[CONTA]"} em ${m.date}`).join("\n")}

INVESTIMENTOS:
- Patrimônio investido: ${fmt(invCurrent)}
- Total aportado: ${fmt(invInvested)}
- Rentabilidade acumulada: ${invReturn.toFixed(1)}%
- Reserva de emergência: ${reservaMeses.toFixed(1)} meses de gastos

EXEMPLOS DE INSIGHTS BONS:
{"icon":"🍔","title":"Alimentação subiu 28% vs mês anterior","description":"Saiu de R$ 600 em abril para R$ 768 em maio. As 3 idas ao restaurante (R$ 180 cada) representam 70% desse aumento. Cortar 1 jantar/semana economiza R$ 720/mês.","type":"warning"}
{"icon":"💳","title":"Cartão consumindo 38% da renda","description":"R$ 1.520 de fatura para R$ 4.000 de receita é alto. Acima de 30% começa a comprometer o caixa. Tente migrar gastos recorrentes (Netflix, Spotify) para débito automático.","type":"warning"}
{"icon":"🏆","title":"Reserva de emergência confortável","description":"Você tem 4.2 meses de despesas guardadas em investimentos. Considera-se ideal 3-6 meses, então pode focar em ativos de mais retorno como ETFs ou ações.","type":"achievement"}

Retorne APENAS um JSON array válido (sem markdown, sem texto antes ou depois):
[{"icon":"emoji","title":"título curto e específico","description":"texto detalhado com números e ações concretas","type":"warning|tip|achievement"}]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um consultor financeiro brasileiro que dá conselhos específicos com números reais. Retorne APENAS um JSON array válido, sem markdown, sem texto antes ou depois." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ insights: fallbackInsights, source: "local-fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await response.text();
    try {
      const parsed = JSON.parse(raw);
      const content = parsed.choices?.[0]?.message?.content ?? "[]";
      const insights = JSON.parse(content);
      return new Response(JSON.stringify({ insights, source: "ai" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ insights: fallbackInsights, source: "local-fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("financial-insights error:", e);
    return new Response(JSON.stringify({ insights: [], error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
