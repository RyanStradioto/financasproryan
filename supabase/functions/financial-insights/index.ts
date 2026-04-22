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
    const { income = [], expenses = [], categories = [], profile = null, month_label = "este mês" } = await req.json();
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

    const totalIncome = income.reduce((s: number, i: Record<string, unknown>) => s + Number(i.amount), 0);
    const totalExpenses = expenses.reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;
    const dailyAvg = totalExpenses / 30;
    const categoryMetrics = categories.map((c: Record<string, unknown>) => {
      const spent = expenses.filter((e: Record<string, unknown>) => e.category_id === c.id).reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);
      const budget = Number(c.monthly_budget) || 0;
      return { name: c.name, spent, budget, pct: totalExpenses > 0 ? (spent / totalExpenses * 100) : 0 };
    }).sort((a, b) => b.spent - a.spent);

    const prompt = `Você é um consultor financeiro pessoal. Gere 4 ou 5 insights em JSON para ${month_label}.
Receitas: R$ ${totalIncome.toFixed(2)}
Despesas: R$ ${totalExpenses.toFixed(2)}
Taxa de poupança: ${savingsRate.toFixed(1)}%
Média diária de despesas: R$ ${dailyAvg.toFixed(2)}
Categorias:
${categoryMetrics.map(c => `${c.name}: R$ ${c.spent.toFixed(2)} (${c.pct.toFixed(1)}%) orçamento ${c.budget || 0}`).join("\n")}

Formato obrigatório:
[{"icon":"emoji","title":"titulo","description":"texto especifico com numeros","type":"warning|tip|achievement"}]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Retorne APENAS um JSON array válido, sem markdown." },
          { role: "user", content: prompt },
        ],
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
