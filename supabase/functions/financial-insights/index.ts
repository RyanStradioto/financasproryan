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

    const totalIncome = income.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

    const catSummary = categories.map((c: any) => {
      const spent = expenses.filter((e: any) => e.category_id === c.id).reduce((s: number, e: any) => s + Number(e.amount), 0);
      return `${c.icon} ${c.name}: R$ ${spent.toFixed(2)} (orçamento: R$ ${c.monthly_budget || 0})`;
    }).join("\n");

    const prompt = `Analise os dados financeiros abaixo e gere 4-5 insights/dicas personalizados em português brasileiro. Seja específico, use os números reais. Formato: retorne um JSON array de objetos com "icon" (emoji), "title" (curto), "description" (1-2 frases), "type" ("tip" | "warning" | "achievement").

Dados do mês:
- Receita total: R$ ${totalIncome.toFixed(2)}
- Despesa total: R$ ${totalExpenses.toFixed(2)}
- Saldo: R$ ${(totalIncome - totalExpenses).toFixed(2)}
- Taxa de economia: ${totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0}%
${profile?.monthly_salary ? `- Salário: R$ ${profile.monthly_salary}` : ''}

Gastos por categoria:
${catSummary}`;

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
