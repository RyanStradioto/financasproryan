import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { income, expenses, categories, profile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const totalIncome = income.reduce((s: number, i: Record<string, unknown>) => s + Number(i.amount), 0);
    const totalExpenses = expenses.reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);

    const catSummary = categories.map((c: Record<string, unknown>) => {
      const spent = expenses.filter((e: Record<string, unknown>) => e.category_id === c.id).reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);
      return `${c.icon} ${c.name}: R$ ${spent.toFixed(2)} (orçamento: R$ ${c.monthly_budget || 0})`;
    }).join("\n");

    // Calcular métricas analíticas detalhadas
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;
    const dailyAvg = totalExpenses / 30;
    const categoryMetrics = categories.map((c: Record<string, unknown>) => {
      const spent = expenses.filter((e: Record<string, unknown>) => e.category_id === c.id).reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);
      const budget = Number(c.monthly_budget) || 0;
      return { name: c.name, spent, budget, pct: totalExpenses > 0 ? (spent / totalExpenses * 100) : 0 };
    }).sort((a, b) => b.spent - a.spent);

    const prompt = `VOCÊ É UM ESPECIALISTA EM FINANÇAS PESSOAIS. Faça uma análise PROFUNDA e MUITO ESPECÍFICA com números reais.

📊 DADOS DO MÊS:
Receita: R$ ${totalIncome.toFixed(2)}
Despesas: R$ ${totalExpenses.toFixed(2)}
Saldo: R$ ${(totalIncome - totalExpenses).toFixed(2)}
Taxa poupança: ${savingsRate.toFixed(1)}%
Média diária: R$ ${dailyAvg.toFixed(2)}
${profile?.monthly_salary ? `Salário: R$ ${profile.monthly_salary} | Percentual gasto: ${(totalExpenses / Number(profile.monthly_salary) * 100).toFixed(1)}%` : ''}

💰 GASTOS DETALHADOS:
${categoryMetrics.map(c => `${c.name}: R$ ${c.spent.toFixed(2)} (${c.pct.toFixed(1)}% do total)${c.budget ? ` [Orçamento: R$ ${c.budget}]` : ''}`).join('\\n')}

🎯 ANÁLISE REQUERIDA:
1. Se categoria >40%: calcule EXATAMENTE economias cortando 5%, 10%, 15%
2. Se ultrapassou orçamento: diga QUANTO e quantos dias faltam para resolver
3. Se poupança <20%: mostre qual categoria atingindo X% chega a 20%
4. Se sobra dinheiro: calcule quanto junta em 3/6/12 meses
5. Compare com padrão: Alimentação 25-35%, Transporte 10-15%, Lazer 5-10%

⚡ FORMATO OBRIGATÓRIO: JSON array com 4-5 objetos
[{"icon":"emoji","title":"título","description":"análise com NÚMEROS específicos","type":"warning|tip|achievement"}]

� IMPORTANTE:
- use apenas um emoji curto no campo "icon"
- não repita emojis dentro do título
- mantenha o título limpo e direto
- ofereça recomendações claras com valores e percentuais

�🚫 ERROS A EVITAR:
ERRADO: "Reduza gastos com alimentação"
CORRETO: "Alimentação consumiu R$ 850 (42%). Cortando 15% (R$ 128) cai para 28% - padrão ideal"

ERRADO: "Poupança boa"
CORRETO: "Poupança 22% = R$ 450. Em 6 meses terá R$ 2.700 para emergências"

Seja EXTREMAMENTE específico com valores, percentuais e ações.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Você é um consultor financeiro pessoal. Retorne APENAS um JSON array válido, sem markdown." },
          { role: "user", content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_insights",
              description: "Generate financial insights",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        icon: { type: "string" },
                        title: { type: "string" },
                        description: { type: "string" },
                        type: { type: "string", enum: ["tip", "warning", "achievement"] }
                      },
                      required: ["icon", "title", "description", "type"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["insights"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_insights" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ insights: [], error: "rate_limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ insights: [], error: "payment_required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let insights = [];
    
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        insights = parsed.insights || [];
      } catch { /* fallback empty */ }
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("financial-insights error:", e);
    return new Response(JSON.stringify({ insights: [], error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
