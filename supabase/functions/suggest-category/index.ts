import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description, categories } = await req.json();

    // Provedor de IA generico (compativel com OpenAI). Padrao: Google Gemini.
    // Configure o secret AI_API_KEY (ou GEMINI_API_KEY). Opcional: AI_BASE_URL, AI_MODEL_LITE.
    const aiApiKey  = Deno.env.get("AI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
    const aiBaseUrl = (Deno.env.get("AI_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, "");
    const aiModel   = Deno.env.get("AI_MODEL_LITE") || Deno.env.get("AI_MODEL") || "gemini-2.5-flash-lite";

    // Sem chave configurada: nao sugere (a categorizacao manual continua funcionando).
    if (!aiApiKey || !description || !categories || categories.length === 0) {
      return new Response(JSON.stringify({ category_id: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categoryList = categories.map((c: { id: string; name: string; icon: string }) => 
      `- ID: ${c.id}, Nome: ${c.icon} ${c.name}`
    ).join("\n");

    const response = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: "system",
            content: `Você é um classificador de despesas. Dada a descrição de uma despesa, retorne o ID da categoria mais adequada. Responda APENAS com o ID, nada mais. Se nenhuma categoria se encaixar, responda "null".

Categorias disponíveis:
${categoryList}`
          },
          { role: "user", content: description }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ category_id: null, error: "rate_limited" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ category_id: null }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const suggested = data.choices?.[0]?.message?.content?.trim() || null;
    
    // Validate it's a real category ID
    const validId = categories.find((c: { id: string }) => c.id === suggested)?.id || null;

    return new Response(JSON.stringify({ category_id: validId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-category error:", e);
    return new Response(JSON.stringify({ category_id: null, error: e instanceof Error ? e.message : "Unknown" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
