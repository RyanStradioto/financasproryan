import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description, categories } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!description || !categories || categories.length === 0) {
      return new Response(JSON.stringify({ category_id: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categoryList = categories.map((c: { id: string; name: string; icon: string }) => 
      `- ID: ${c.id}, Nome: ${c.icon} ${c.name}`
    ).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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
