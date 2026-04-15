import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatScheduleDate(date: Date): string {
  const weekday = normalizeText(new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "America/Sao_Paulo",
  }).format(date));
  const day = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(date);
  return `${weekday}, ${day} as ${time}`;
}

function getNextWeeklySend(now = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  let daysUntilMonday = (1 - next.getUTCDay() + 7) % 7;
  if (daysUntilMonday === 0 && now >= next) {
    daysUntilMonday = 7;
  }
  next.setUTCDate(next.getUTCDate() + daysUntilMonday);
  return formatScheduleDate(next);
}

interface CatItem {
  name: string;
  icon: string;
  value: number;
  budget: number;
}

function generateInsights(
  totalIncome: number,
  totalExpenses: number,
  balance: number,
  savingsRate: number,
  categories: CatItem[],
): string[] {
  const tips: string[] = [];

  if (totalIncome === 0 && totalExpenses > 0) {
    tips.push("Nenhuma receita foi registrada neste mês. Registre entradas para ter um saldo mais preciso.");
  } else if (balance < 0) {
    tips.push(`O mês fechou no negativo em ${fmt(Math.abs(balance))}. Ajuste os gastos para recuperar margem no próximo mês.`);
  } else if (savingsRate < 10 && totalIncome > 0) {
    tips.push(`A taxa de poupança ficou em ${savingsRate.toFixed(1)}%. O objetivo recomendado é 20%.`);
  } else if (savingsRate >= 20) {
    tips.push(`Bom mês: poupança de ${savingsRate.toFixed(1)}%. Mantenha o padrão para consolidar o resultado anual.`);
  }

  const overBudget = categories.filter((c) => c.budget > 0 && c.value > c.budget);
  if (overBudget.length > 0) {
    const names = overBudget.slice(0, 2).map((c) => c.name).join(", ");
    tips.push(`Categorias acima do orçamento: ${names}. Revise limites para evitar excesso recorrente.`);
  }

  if (categories.length > 0 && totalExpenses > 0) {
    const top = categories[0];
    const pct = Math.round((top.value / totalExpenses) * 100);
    if (pct > 35) {
      tips.push(`${top.name} concentrou ${pct}% das despesas do mês. Uma pequena redução nessa categoria gera grande impacto.`);
    }
  }

  if (tips.length === 0) {
    tips.push("Mês equilibrado. Continue registrando todas as transações para manter previsibilidade.");
  }

  return tips.slice(0, 4);
}

function buildWeeklyHtml(params: {
  weekLabel: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number;
  categories: CatItem[];
  insights: string[];
  incomeCount: number;
  expenseCount: number;
  nextScheduledSend: string;
}): string {
  const {
    weekLabel,
    totalIncome,
    totalExpenses,
    balance,
    savingsRate,
    categories,
    insights,
    incomeCount,
    expenseCount,
    nextScheduledSend,
  } = params;

  const balanceColor = balance >= 0 ? "#16a34a" : "#dc2626";
  const savingsColor = savingsRate >= 20 ? "#16a34a" : savingsRate >= 10 ? "#d97706" : "#dc2626";

  const categoryRows = categories.slice(0, 6).map((c) => {
    const pct = totalExpenses > 0 ? Math.round((c.value / totalExpenses) * 100) : 0;
    const over = c.budget > 0 && c.value > c.budget;
    return `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#111827;">${c.icon} ${c.name}</td>
        <td style="padding:8px 0;">
          <div style="height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
            <div style="height:8px;width:${Math.min(pct, 100)}%;background:${over ? "#dc2626" : "#2563eb"};"></div>
          </div>
        </td>
        <td style="padding:8px 0;font-size:13px;color:#374151;text-align:right;white-space:nowrap;">${fmt(c.value)} (${pct}%)</td>
      </tr>
    `;
  }).join("");

  const insightRows = insights.map((t) => `
    <li style="margin:0 0 10px 0;color:#1f2937;line-height:1.55;font-size:14px;">${t}</li>
  `).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resumo Semanal</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:22px 24px;background:#0f172a;color:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:24px;font-weight:700;">FinancasPro</td>
                  <td align="right" style="font-size:13px;color:#cbd5e1;">Mês ${weekLabel}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:6px;font-size:13px;color:#94a3b8;">Resumo mensal das suas finanças</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:8px;font-size:12px;color:#cbd5e1;">Proximo envio automatico: ${nextScheduledSend} (horario de Brasilia)</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 24px 12px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="33%" style="padding-right:8px;">
                    <div style="border:1px solid #dcfce7;background:#f0fdf4;border-radius:10px;padding:12px;">
                      <div style="font-size:11px;color:#15803d;text-transform:uppercase;font-weight:700;">Receitas</div>
                      <div style="font-size:24px;color:#166534;font-weight:700;margin-top:6px;">${fmt(totalIncome)}</div>
                      <div style="font-size:12px;color:#4b5563;margin-top:4px;">${incomeCount} lancamentos</div>
                    </div>
                  </td>
                  <td width="33%" style="padding:0 4px;">
                    <div style="border:1px solid #fee2e2;background:#fef2f2;border-radius:10px;padding:12px;">
                      <div style="font-size:11px;color:#b91c1c;text-transform:uppercase;font-weight:700;">Despesas</div>
                      <div style="font-size:24px;color:#991b1b;font-weight:700;margin-top:6px;">${fmt(totalExpenses)}</div>
                      <div style="font-size:12px;color:#4b5563;margin-top:4px;">${expenseCount} lancamentos</div>
                    </div>
                  </td>
                  <td width="33%" style="padding-left:8px;">
                    <div style="border:1px solid #e5e7eb;background:#f9fafb;border-radius:10px;padding:12px;">
                      <div style="font-size:11px;color:#334155;text-transform:uppercase;font-weight:700;">Saldo</div>
                      <div style="font-size:24px;color:${balanceColor};font-weight:700;margin-top:6px;">${fmt(balance)}</div>
                      <div style="font-size:12px;color:${savingsColor};margin-top:4px;">${savingsRate.toFixed(1)}% poupado</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${categories.length > 0 ? `
          <tr>
            <td style="padding:8px 24px 8px 24px;">
              <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:6px;">Categorias do mês</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${categoryRows}
              </table>
            </td>
          </tr>
          ` : ""}

          <tr>
            <td style="padding:10px 24px 20px 24px;">
              <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:8px;">Recomendações para o próximo mês</div>
              <ul style="padding-left:18px;margin:0;">${insightRows}</ul>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;">
              <div style="font-size:12px;color:#64748b;">Mensagem automatica do FinancasPro.</div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">Ajuste notificacoes em Configuracoes.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const dataUrl = Deno.env.get("DATA_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const dataAnonKey = Deno.env.get("DATA_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dataServiceRole = Deno.env.get("DATA_SUPABASE_SERVICE_ROLE_KEY");

    const authHeader = req.headers.get("Authorization");
    const userJwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const isServiceRoleCall = userJwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const browserOrigin = req.headers.get("origin");

    if (!userJwt && browserOrigin) {
      return new Response(JSON.stringify({ error: "Sessao invalida. Faca login novamente para enviar teste." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    interface ProfileEntry {
      user_id: string;
      email: string;
    monthly_salary?: number;
      work_hours_per_day?: number;
      work_days_per_week?: number;
    }

    let profilesToProcess: ProfileEntry[] = [];

    if (!isServiceRoleCall && userJwt) {
      const dataClient = createClient(dataUrl, dataAnonKey, {
        global: { headers: { Authorization: `Bearer ${userJwt}` } },
        auth: { persistSession: false },
      });

      const { data: { user } } = await dataClient.auth.getUser();
      if (!user?.email) {
        return new Response(JSON.stringify({ error: "Could not identify user" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await dataClient.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      profilesToProcess = [{ user_id: user.id, email: user.email, ...(profile || {}) }];
    } else {
      if (!dataServiceRole) {
        const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: profiles } = await adminClient.from("profiles").select("*").eq("weekly_summary_enabled", true);
        if (!profiles || profiles.length === 0) {
          return new Response(JSON.stringify({ message: "No users with weekly summary enabled" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        for (const p of profiles) {
          const { data: ud } = await adminClient.auth.admin.getUserById(p.user_id);
          if (ud?.user?.email) profilesToProcess.push({ ...p, email: ud.user.email });
        }
      } else {
        const dataAdminClient = createClient(dataUrl, dataServiceRole);
        const { data: profiles, error } = await dataAdminClient.from("profiles").select("*").eq("weekly_summary_enabled", true);
        if (error) throw error;
        if (!profiles || profiles.length === 0) {
          return new Response(JSON.stringify({ message: "No users with weekly summary enabled" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        for (const p of profiles) {
          const { data: ud } = await dataAdminClient.auth.admin.getUserById(p.user_id);
          if (ud?.user?.email) profilesToProcess.push({ ...p, email: ud.user.email });
        }
      }
    }

    const now = new Date();
    // Get current month data instead of weekly
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = startOfMonth.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];
    const monthNameStr = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(now);
    const weekLabel = monthNameStr.charAt(0).toUpperCase() + monthNameStr.slice(1);
    const nextScheduledSend = getNextWeeklySend(now);

    const results = [];

    for (const profile of profilesToProcess) {
      const email = profile.email;
      if (!email) continue;

      let dataClient;
      if (!isServiceRoleCall && userJwt) {
        dataClient = createClient(dataUrl, dataAnonKey, {
          global: { headers: { Authorization: `Bearer ${userJwt}` } },
          auth: { persistSession: false },
        });
      } else {
        const key = dataServiceRole || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const url = dataServiceRole ? dataUrl : Deno.env.get("SUPABASE_URL")!;
        dataClient = createClient(url, key);
      }

      const [incomeResult, expensesResult, categoriesResult] = await Promise.all([
        dataClient.from("income").select("id,amount,date,description,status").eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate),
        dataClient.from("expenses").select("id,amount,date,description,category_id,status").eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate),
        dataClient.from("categories").select("id,name,icon,color,monthly_budget").eq("user_id", profile.user_id),
      ]);

      if (incomeResult.error) throw incomeResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      const income = incomeResult.data || [];
      const expenses = expensesResult.data || [];
      const categories = categoriesResult.data || [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalIncome = income.reduce((s: number, i: any) => s + Number(i.amount), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
      const balance = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catBreakdown: CatItem[] = categories
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((cat: any) => ({
          name: String(cat.name),
          icon: String(cat.icon || "-"),
          budget: Number(cat.monthly_budget) || 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: expenses.filter((e: any) => e.category_id === cat.id).reduce((s: number, e: any) => s + Number(e.amount), 0),
        }))
        .filter((c: CatItem) => c.value > 0)
        .sort((a: CatItem, b: CatItem) => b.value - a.value);

      const insights = generateInsights(totalIncome, totalExpenses, balance, savingsRate, catBreakdown);

      const html = buildWeeklyHtml({
        weekLabel,
        totalIncome,
        totalExpenses,
        balance,
        savingsRate,
        categories: catBreakdown,
        insights,
        incomeCount: income.length,
        expenseCount: expenses.length,
        nextScheduledSend,
      });

      results.push({ email, totalIncome, totalExpenses, balance, savingsRate: savingsRate.toFixed(1) });

      if (resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: "FinancasPro <onboarding@resend.dev>",
            to: [email],
            subject: `Resumo Mensal | ${weekLabel}`,
            html,
          }),
        });
        const resData = await res.json();
        if (!res.ok) {
          console.error(`Resend error for ${email}:`, JSON.stringify(resData));
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in weekly-summary:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
