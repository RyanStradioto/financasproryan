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
  prevIncome?: Item[];
  prevExpenses?: Item[];
  ccTransactions?: Item[];
  categories: Category[];
  profile?: { monthly_salary?: number | null } | null;
  investments?: Array<{ name?: string; current_value?: number; total_invested?: number; type?: string }>;
  monthLabel?: string;
}): Insight[] {
  const insights: Insight[] = [];

  const totalIncome = params.income
    .filter((item) => item.status === "concluido")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const totalExpensesAccount = params.expenses
    .filter((item) => item.status === "concluido")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const totalCC = (params.ccTransactions ?? []).reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = totalExpensesAccount + totalCC;
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

  const prevTotalIncome = (params.prevIncome ?? [])
    .filter((item) => item.status === "concluido")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const prevTotalExpenses = (params.prevExpenses ?? [])
    .filter((item) => item.status === "concluido")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  // Category breakdown (combine non-CC expenses + CC)
  const categoryBreakdown = params.categories
    .map((category) => {
      const fromExp = params.expenses
        .filter((e) => e.status === "concluido" && e.category_id === category.id)
        .reduce((s, e) => s + Number(e.amount), 0);
      const fromCC = (params.ccTransactions ?? [])
        .filter((t) => t.category_id === category.id)
        .reduce((s, t) => s + Number(t.amount), 0);
      const spent = fromExp + fromCC;
      return {
        ...category,
        spent,
        percent: totalExpenses > 0 ? (spent / totalExpenses) * 100 : 0,
      };
    })
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  const today = new Date();
  const dayOfMonth = today.getDate();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthProgress = (dayOfMonth / lastDay) * 100;
  const dailyAvg = dayOfMonth > 0 ? totalExpenses / dayOfMonth : 0;
  const projectedClose = dailyAvg * lastDay;

  // ── 1. Pace insight: are you spending faster than the calendar? ──
  if (totalExpenses > 0 && monthProgress < 90) {
    const remainingBudget = (params.categories.reduce((s, c) => s + Number(c.monthly_budget || 0), 0)) - totalExpenses;
    const daysLeft = lastDay - dayOfMonth;
    if (remainingBudget > 0 && daysLeft > 0) {
      const dailyAllowance = remainingBudget / daysLeft;
      insights.push({
        icon: "⏱️",
        title: `Restam ${daysLeft} dias e ${fmt(remainingBudget)} de orçamento`,
        description: `Para terminar o mês no orçamento, você pode gastar até ${fmt(dailyAllowance)}/dia. Sua média atual é ${fmt(dailyAvg)}/dia — ${dailyAvg > dailyAllowance ? `precisa cortar ${((dailyAvg - dailyAllowance) / dailyAvg * 100).toFixed(0)}%` : "está dentro do ritmo"}.`,
        type: dailyAvg > dailyAllowance * 1.2 ? "warning" : dailyAvg > dailyAllowance ? "tip" : "achievement",
      });
    } else if (totalExpenses > 0 && projectedClose > 0) {
      insights.push({
        icon: "📈",
        title: `Projeção de fechamento: ${fmt(projectedClose)}`,
        description: `Mantendo a média de ${fmt(dailyAvg)}/dia até o dia ${lastDay}, o mês fecha em ${fmt(projectedClose)}. Hoje (dia ${dayOfMonth}) você já gastou ${fmt(totalExpenses)}.`,
        type: "tip",
      });
    }
  }

  // ── 2. MoM expense delta with cause attribution ──
  if (prevTotalExpenses > 0 && totalExpenses > 0) {
    const expDiff = ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100;
    const expDelta = totalExpenses - prevTotalExpenses;
    if (Math.abs(expDiff) >= 8) {
      // Find which category drove the change most
      const prevCatTotals = new Map<string, number>();
      (params.prevExpenses ?? []).forEach((e) => {
        if (e.status === "concluido" && e.category_id) {
          prevCatTotals.set(e.category_id, (prevCatTotals.get(e.category_id) || 0) + Number(e.amount));
        }
      });
      let topDriver: { name: string; icon: string; delta: number } | null = null;
      categoryBreakdown.forEach((c) => {
        const prev = prevCatTotals.get(c.id) || 0;
        const delta = c.spent - prev;
        if (!topDriver || Math.abs(delta) > Math.abs(topDriver.delta)) {
          topDriver = { name: c.name, icon: c.icon ?? "", delta };
        }
      });
      if (expDiff > 0) {
        insights.push({
          icon: "📈",
          title: `Gastos ${expDiff.toFixed(0)}% acima do mês anterior`,
          description: `Saiu de ${fmt(prevTotalExpenses)} para ${fmt(totalExpenses)} (+${fmt(expDelta)}).${topDriver ? ` ${topDriver.icon} ${topDriver.name} foi o maior responsável (${topDriver.delta > 0 ? "+" : ""}${fmt(topDriver.delta)}).` : ""}`,
          type: expDiff > 20 ? "warning" : "tip",
        });
      } else {
        insights.push({
          icon: "📉",
          title: `Gastos caíram ${Math.abs(expDiff).toFixed(0)}% — economizou ${fmt(Math.abs(expDelta))}`,
          description: `De ${fmt(prevTotalExpenses)} para ${fmt(totalExpenses)}.${topDriver && topDriver.delta < 0 ? ` ${topDriver.icon} ${topDriver.name} foi a maior queda (${fmt(topDriver.delta)}).` : " Mantenha o ritmo!"}`,
          type: "achievement",
        });
      }
    }
  }

  // ── 3. CC bill stress test (CC vs income ratio) ──
  if (totalCC > 0 && totalIncome > 0) {
    const ccRatio = (totalCC / totalIncome) * 100;
    if (ccRatio > 50) {
      insights.push({
        icon: "💳",
        title: `Cartão consome ${ccRatio.toFixed(0)}% da renda`,
        description: `${fmt(totalCC)} de fatura para ${fmt(totalIncome)} de receita é alto. Acima de 30% começa a comprometer fluxo. Migre gastos recorrentes (Netflix, Spotify, plano celular) para débito automático para soltar pelo menos ${fmt(totalCC * 0.15)}/mês.`,
        type: "warning",
      });
    } else if (ccRatio < 25 && totalCC > 100) {
      insights.push({
        icon: "💳",
        title: `Uso saudável do cartão (${ccRatio.toFixed(0)}% da renda)`,
        description: `${fmt(totalCC)} em fatura representa apenas ${ccRatio.toFixed(0)}% dos seus ${fmt(totalIncome)} de receita — proporção considerada excelente. Continue priorizando débito/PIX para gastos do dia-a-dia.`,
        type: "achievement",
      });
    }
  }

  // ── 4. Top category deep-dive ──
  if (categoryBreakdown.length > 0) {
    const topCategory = categoryBreakdown[0];
    if (topCategory.percent >= 30) {
      const cut15 = topCategory.spent * 0.15;
      insights.push({
        icon: topCategory.icon || "📊",
        title: `${topCategory.name} concentra ${topCategory.percent.toFixed(0)}% dos gastos`,
        description: `${fmt(topCategory.spent)} foi gasto em ${topCategory.name} (de um total de ${fmt(totalExpenses)}). É um nível alto de concentração. Cortar 15% nessa categoria libera ${fmt(cut15)}/mês — em 12 meses são ${fmt(cut15 * 12)}, suficiente para ${fmt(cut15 * 12) ? "construir uma reserva" : ""}.`,
        type: topCategory.percent >= 45 ? "warning" : "tip",
      });
    }
  }

  // ── 5. Budget overruns (specific) ──
  const overBudgetCats = categoryBreakdown.filter((c) => Number(c.monthly_budget || 0) > 0 && c.spent > Number(c.monthly_budget));
  if (overBudgetCats.length > 0) {
    const worst = overBudgetCats.sort((a, b) => (b.spent - Number(b.monthly_budget!)) - (a.spent - Number(a.monthly_budget!)))[0];
    const exceeded = worst.spent - Number(worst.monthly_budget);
    const exceedPct = (exceeded / Number(worst.monthly_budget)) * 100;
    insights.push({
      icon: "🎯",
      title: `${worst.icon || ""} ${worst.name} estourou ${exceedPct.toFixed(0)}% do orçamento`,
      description: `Gastou ${fmt(worst.spent)} de um orçamento de ${fmt(Number(worst.monthly_budget))} (excesso de ${fmt(exceeded)}).${overBudgetCats.length > 1 ? ` Outras ${overBudgetCats.length - 1} categoria(s) também estouraram.` : ""} No próximo mês, considere ajustar o limite ou aplicar a regra "envelope" — separe o valor no início do mês.`,
      type: "warning",
    });
  }

  // ── 6. Savings rate context ──
  if (totalIncome > 0) {
    if (savingsRate >= 30) {
      insights.push({
        icon: "🏆",
        title: `Poupança excepcional: ${savingsRate.toFixed(0)}%`,
        description: `Você economiza ${savingsRate.toFixed(1)}% da renda — bem acima dos 20% recomendados. Mantendo esse ritmo, em 12 meses acumula ${fmt(balance * 12)}. Considere estudar investimentos de maior risco/retorno (ETFs, ações, FIIs) para acelerar metas.`,
        type: "achievement",
      });
    } else if (savingsRate >= 15) {
      const target20 = totalIncome * 0.2;
      const missing = target20 - Math.max(balance, 0);
      insights.push({
        icon: "👍",
        title: `Poupança em ${savingsRate.toFixed(0)}% — quase na meta`,
        description: `Você está em um bom caminho. Para chegar aos 20% (padrão recomendado), falta segurar mais ${fmt(missing)}/mês. Uma forma fácil: identifique 2 gastos recorrentes pequenos (R$ 30-50) e remova-os no próximo ciclo.`,
        type: "tip",
      });
    } else if (savingsRate > 0) {
      insights.push({
        icon: "⚠️",
        title: `Poupança baixa: apenas ${savingsRate.toFixed(0)}%`,
        description: `Você está economizando só ${fmt(balance)} de uma renda de ${fmt(totalIncome)}. Especialistas recomendam 20%+ (no seu caso, ${fmt(totalIncome * 0.2)}). Comece atacando ${categoryBreakdown[0]?.name || "sua maior categoria"} — corte 20% lá e isso já te aproxima da meta.`,
        type: "warning",
      });
    } else if (balance < 0) {
      insights.push({
        icon: "🚨",
        title: `Mês no vermelho: déficit de ${fmt(Math.abs(balance))}`,
        description: `Suas despesas (${fmt(totalExpenses)}) superaram as receitas (${fmt(totalIncome)}) em ${fmt(Math.abs(balance))}. Ação imediata: reveja as 3 maiores categorias (${categoryBreakdown.slice(0, 3).map((c) => c.name).join(", ")}) e corte 25% em cada uma. Isso já reverte o saldo no próximo mês.`,
        type: "warning",
      });
    }
  }

  // ── 7. Investments / emergency reserve ──
  const invCurrent = (params.investments ?? []).reduce((s, i) => s + Number(i.current_value || 0), 0);
  const invInvested = (params.investments ?? []).reduce((s, i) => s + Number(i.total_invested || 0), 0);
  if (invCurrent > 0 && totalExpenses > 0) {
    const reservaMeses = invCurrent / totalExpenses;
    if (reservaMeses < 3) {
      const target3m = totalExpenses * 3;
      const missing = target3m - invCurrent;
      insights.push({
        icon: "🛡️",
        title: `Reserva cobre só ${reservaMeses.toFixed(1)} meses de gastos`,
        description: `Você tem ${fmt(invCurrent)} investido, mas seus gastos médios são ${fmt(totalExpenses)}/mês. O ideal é 3-6 meses guardados. Para chegar a 3 meses (${fmt(target3m)}), faltam ${fmt(missing)}. Aporte ${fmt(missing / 12)}/mês durante 1 ano para alcançar.`,
        type: "warning",
      });
    } else if (reservaMeses >= 6) {
      insights.push({
        icon: "🛡️",
        title: `Reserva sólida: ${reservaMeses.toFixed(1)} meses de gastos`,
        description: `Com ${fmt(invCurrent)} investidos e gastos médios de ${fmt(totalExpenses)}, sua reserva já cobre meio ano de imprevistos. Além disso, sua carteira ${invCurrent > invInvested ? `rendeu ${(((invCurrent - invInvested) / Math.max(invInvested, 1)) * 100).toFixed(1)}%` : "está em equilíbrio"}. Pode focar em ativos de mais retorno (FIIs, ETFs).`,
        type: "achievement",
      });
    }
  } else if (totalIncome > 0 && invCurrent === 0) {
    insights.push({
      icon: "🛡️",
      title: "Sem reserva de emergência",
      description: `Você não tem nada investido. O primeiro passo é construir uma reserva de 3 meses de gastos (${fmt(totalExpenses * 3)}). Comece com ${fmt(totalIncome * 0.1)}/mês (10% da renda) em CDB de liquidez diária do seu banco — em 12 meses já tem ${fmt(totalIncome * 1.2)} guardados.`,
      type: "warning",
    });
  }

  // ── 8. Salary share (if profile has salary) ──
  const salary = Number(params.profile?.monthly_salary || 0);
  if (salary > 0 && totalExpenses > 0 && totalIncome === 0) {
    const expenseShare = (totalExpenses / salary) * 100;
    insights.push({
      icon: "🧠",
      title: `Despesas consumiram ${expenseShare.toFixed(0)}% do salário`,
      description: `Sem registrar receitas no mês, suas despesas (${fmt(totalExpenses)}) representam ${expenseShare.toFixed(1)}% do seu salário declarado (${fmt(salary)}). ${expenseShare > 80 ? "Nível crítico — registre suas receitas para ter um quadro completo." : "Lembre de adicionar suas receitas para análises mais precisas."}`,
      type: expenseShare > 80 ? "warning" : "tip",
    });
  }

  return insights.slice(0, 8);
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
    // Provedor de IA generico (compativel com OpenAI). Padrao: Google Gemini.
    // Configure o secret AI_API_KEY (ou GEMINI_API_KEY). Opcional: AI_BASE_URL, AI_MODEL.
    const aiApiKey  = Deno.env.get("AI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
    const aiBaseUrl = (Deno.env.get("AI_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, "");
    const aiModel   = Deno.env.get("AI_MODEL") || "gemini-2.5-flash";

    const fallbackInsights = buildDeterministicInsights({
      income,
      expenses,
      prevIncome: prev_income,
      prevExpenses: prev_expenses,
      ccTransactions: cc_transactions,
      categories,
      profile,
      investments,
      monthLabel: month_label,
    });

    if (!aiApiKey) {
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

    const response = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
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
