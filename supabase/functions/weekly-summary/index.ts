import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface CatItem { name: string; icon: string; value: number; budget: number }

function generateInsights(
  totalIncome: number,
  totalExpenses: number,
  balance: number,
  savingsRateNum: number,
  catBreakdown: CatItem[],
  workDaysForExpenses: number,
): string[] {
  const tips: string[] = [];

  if (totalIncome === 0 && totalExpenses > 0) {
    tips.push(`📝 Nenhuma receita registrada esta semana. Lembre-se de lançar seus ganhos para ter um saldo preciso.`);
  } else if (balance < 0) {
    const topCat = catBreakdown[0];
    tips.push(`🚨 Semana no negativo! Despesas superaram receitas em <strong>${fmt(Math.abs(balance))}</strong>. ${topCat ? `Revise os gastos em ${topCat.icon} ${topCat.name}.` : "Revise seus gastos urgente."}`);
  } else if (savingsRateNum < 10 && totalIncome > 0) {
    const topCat = catBreakdown[0];
    tips.push(`📉 Taxa de poupança de <strong>${savingsRateNum.toFixed(1)}%</strong> (meta: 20%). ${topCat ? `Tente reduzir gastos em ${topCat.icon} ${topCat.name} na próxima semana.` : ""}`);
  } else if (savingsRateNum < 20 && totalIncome > 0) {
    const needed = totalIncome * 0.2 - balance;
    tips.push(`📊 Poupança de <strong>${savingsRateNum.toFixed(1)}%</strong> — quase na meta! Se economizar mais <strong>${fmt(needed)}</strong>, bate os 20%.`);
  } else if (savingsRateNum >= 20) {
    tips.push(`🎉 Meta de poupança atingida com <strong>${savingsRateNum.toFixed(1)}%</strong>! Considere investir o excedente de ${fmt(balance)}.`);
  }

  if (catBreakdown.length > 0 && totalExpenses > 0) {
    const top = catBreakdown[0];
    const topPct = Math.round((top.value / totalExpenses) * 100);
    if (topPct > 40) {
      tips.push(`🔍 ${top.icon} <strong>${top.name}</strong> concentrou ${topPct}% dos seus gastos esta semana. Diversifique melhor suas despesas.`);
    }
  }

  const overBudget = catBreakdown.filter((c) => c.budget > 0 && c.value > c.budget);
  if (overBudget.length > 0) {
    const names = overBudget.slice(0, 2).map((c) => {
      const pct = Math.round(((c.value - c.budget) / c.budget) * 100);
      return `${c.icon} ${c.name} (+${pct}%)`;
    }).join(", ");
    tips.push(`🔴 Orçamento estourado: <strong>${names}</strong>. Estabeleça limites mais rígidos para a próxima semana.`);
  }

  if (workDaysForExpenses > 4) {
    tips.push(`⏱️ Você precisou trabalhar <strong>${workDaysForExpenses.toFixed(1)} dias</strong> só para cobrir as despesas desta semana. Reduza para ampliar sua liberdade financeira.`);
  } else if (workDaysForExpenses > 0 && workDaysForExpenses <= 2) {
    tips.push(`⚡ Excelente! Apenas <strong>${workDaysForExpenses.toFixed(1)} dia(s)</strong> de trabalho para cobrir todas as despesas — controle exemplar!`);
  }

  if (tips.length < 2 && totalIncome > 0 && savingsRateNum >= 20) {
    tips.push(`💡 Que tal criar uma reserva de emergência equivalente a 6 meses de despesas (${fmt(totalExpenses * 26)})?`);
  }

  return tips.slice(0, 4);
}

function buildWeeklyHtml(params: {
  weekLabel: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRateNum: number;
  catBreakdown: CatItem[];
  workDaysForExpenses: number;
  workHoursForExpenses: number;
  hourlyRate: number;
  incomeCount: number;
  expenseCount: number;
  insights: string[];
}): string {
  const {
    weekLabel, totalIncome, totalExpenses, balance, savingsRateNum,
    catBreakdown, workDaysForExpenses, workHoursForExpenses, hourlyRate,
    incomeCount, expenseCount, insights,
  } = params;

  const balClr = balance >= 0 ? "#10b981" : "#ef4444";
  const balBg = balance >= 0 ? "#0d1f17" : "#1f0d0d";
  const balBorder = balance >= 0 ? "#1a3a25" : "#3a1a1a";
  const srClr = savingsRateNum >= 20 ? "#10b981" : savingsRateNum >= 10 ? "#f59e0b" : "#ef4444";

  const categoryRows = catBreakdown.slice(0, 6).map((cat) => {
    const pct = totalExpenses > 0 ? Math.round((cat.value / totalExpenses) * 100) : 0;
    const overBudget = cat.budget > 0 && cat.value > cat.budget;
    const barColor = overBudget ? "#ef4444" : "#10b981";
    return `
    <tr>
      <td style="padding:7px 0;border-bottom:1px solid #1e1e1e;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="125" style="color:#bbb;font-size:13px;vertical-align:middle;">${cat.icon} ${cat.name}${overBudget ? ' <span style="color:#ef4444;font-size:10px;">▲</span>' : ""}</td>
            <td style="vertical-align:middle;padding:0 10px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="${pct}%" bgcolor="${barColor}" style="background:${barColor};height:7px;border-radius:4px;"></td>
                  <td bgcolor="#2a2a2a" style="background:#2a2a2a;height:7px;border-radius:4px;"></td>
                </tr>
              </table>
            </td>
            <td width="95" align="right" style="font-size:12px;color:#ddd;vertical-align:middle;white-space:nowrap;">
              ${fmt(cat.value)} <span style="color:#555;">${pct}%</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join("");

  const insightRows = insights.map((tip) => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #1e1e1e;">
        <p style="margin:0;font-size:13px;color:#d1d5db;line-height:1.6;">${tip}</p>
      </td>
    </tr>`).join("");

  const noDataBlock = incomeCount === 0 && expenseCount === 0 ? `
  <tr><td style="padding:24px;text-align:center;">
    <p style="color:#777;font-size:14px;margin:0;">📝 Nenhuma movimentação registrada esta semana.</p>
    <p style="color:#555;font-size:12px;margin:8px 0 0;">Continue registrando suas transações para receber resumos detalhados!</p>
  </td></tr>` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Resumo Semanal — FinançasPro</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="background:#0a0a0a;">
 <tr><td align="center" style="padding:24px 16px;">

  <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

   <!-- ACCENT BAR -->
   <tr><td style="background:linear-gradient(90deg,#10b981,#059669);height:4px;border-radius:8px 8px 0 0;"></td></tr>

   <!-- HEADER -->
   <tr><td bgcolor="#111111" style="background:#111;padding:28px 32px 20px;border-radius:0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
     <tr>
      <td>
       <p style="margin:0;font-size:22px;font-weight:700;color:#10b981;letter-spacing:-0.5px;">💰 FinançasPro</p>
       <p style="margin:4px 0 0;font-size:14px;color:#888;">Resumo Semanal</p>
      </td>
      <td align="right">
       <p style="margin:0;font-size:12px;color:#555;white-space:nowrap;">${weekLabel}</p>
      </td>
     </tr>
    </table>
   </td></tr>

   <!-- METRICS ROW -->
   <tr><td bgcolor="#111111" style="background:#111;padding:0 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
     <tr>
      <td width="32%" style="padding-right:6px;">
       <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td bgcolor="#0d1f17" style="background:#0d1f17;border:1px solid #1a3a25;border-radius:12px;padding:14px;text-align:center;">
         <p style="margin:0;font-size:10px;color:#10b981;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Receitas</p>
         <p style="margin:6px 0 2px;font-size:18px;font-weight:700;color:#10b981;">${fmt(totalIncome)}</p>
         <p style="margin:0;font-size:11px;color:#555;">${incomeCount} lançto${incomeCount !== 1 ? "s" : ""}</p>
        </td></tr>
       </table>
      </td>
      <td width="32%" style="padding:0 3px;">
       <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td bgcolor="#1f0d0d" style="background:#1f0d0d;border:1px solid #3a1a1a;border-radius:12px;padding:14px;text-align:center;">
         <p style="margin:0;font-size:10px;color:#ef4444;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Despesas</p>
         <p style="margin:6px 0 2px;font-size:18px;font-weight:700;color:#ef4444;">${fmt(totalExpenses)}</p>
         <p style="margin:0;font-size:11px;color:#555;">${expenseCount} lançto${expenseCount !== 1 ? "s" : ""}</p>
        </td></tr>
       </table>
      </td>
      <td width="32%" style="padding-left:6px;">
       <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td bgcolor="${balBg}" style="background:${balBg};border:1px solid ${balBorder};border-radius:12px;padding:14px;text-align:center;">
         <p style="margin:0;font-size:10px;color:${balClr};text-transform:uppercase;letter-spacing:1px;font-weight:600;">Saldo</p>
         <p style="margin:6px 0 2px;font-size:18px;font-weight:700;color:${balClr};">${fmt(balance)}</p>
         <p style="margin:0;font-size:11px;color:${srClr};font-weight:600;">${savingsRateNum.toFixed(1)}% poupado</p>
        </td></tr>
       </table>
      </td>
     </tr>
    </table>
   </td></tr>

   ${hourlyRate > 0 ? `
   <!-- WORK TIME -->
   <tr><td bgcolor="#111111" style="background:#111;padding:0 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
     <tr><td bgcolor="#111827" style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:14px;">
      <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;font-weight:600;">⏱️ Equivalente em Trabalho</p>
      <p style="margin:0;font-size:13px;color:#e2e8f0;line-height:1.5;">
        Para cobrir suas despesas desta semana, você trabalhou 
        <strong style="color:#f59e0b;">${workDaysForExpenses.toFixed(1)} dia(s)</strong>
        (${workHoursForExpenses.toFixed(0)}h) — baseado no seu valor/hora de <strong style="color:#94a3b8;">${fmt(hourlyRate)}</strong>.
      </p>
     </td></tr>
    </table>
   </td></tr>` : ""}

   ${catBreakdown.length > 0 ? `
   <!-- CATEGORIES -->
   <tr><td bgcolor="#111111" style="background:#111;padding:0 32px 20px;">
    <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#e2e8f0;">📊 Gastos por Categoria</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
     ${categoryRows}
    </table>
   </td></tr>` : ""}

   ${noDataBlock ? `<tr><td bgcolor="#111111" style="background:#111;">${noDataBlock}</td></tr>` : ""}

   ${insights.length > 0 ? `
   <!-- INSIGHTS -->
   <tr><td bgcolor="#111111" style="background:#111;padding:0 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
     <tr><td bgcolor="#0f1f2f" style="background:#0f1f2f;border:1px solid #1e3a5f;border-radius:12px;padding:16px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#60a5fa;">🎯 Dicas para a Próxima Semana</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
       ${insightRows}
      </table>
     </td></tr>
    </table>
   </td></tr>` : ""}

   <!-- FOOTER -->
   <tr><td bgcolor="#111111" style="background:#111;padding:16px 32px 28px;border-radius:0 0 12px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
     <tr>
      <td style="border-top:1px solid #222;padding-top:14px;text-align:center;">
       <p style="margin:0;font-size:11px;color:#444;">Enviado automaticamente pelo <strong style="color:#555;">FinançasPro</strong></p>
       <p style="margin:4px 0 0;font-size:10px;color:#333;">Gerencie suas notificações em Configurações → Notificações</p>
      </td>
     </tr>
    </table>
   </td></tr>

   <!-- BOTTOM BORDER -->
   <tr><td style="background:linear-gradient(90deg,#10b981,#059669);height:2px;border-radius:0 0 8px 8px;"></td></tr>

  </table>
 </td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .eq("weekly_summary_enabled", true);

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No users with weekly summary enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startDate = weekAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];
    const weekLabel = `${startDate.split("-").reverse().join("/")} a ${endDate.split("-").reverse().join("/")}`;

    const results = [];

    for (const profile of profiles) {
      const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
      if (!userData?.user?.email) continue;
      const email = userData.user.email;

      const [{ data: income = [] }, { data: expenses = [] }, { data: categories = [] }] = await Promise.all([
        supabase.from("income").select("*").eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate),
        supabase.from("expenses").select("*").eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate),
        supabase.from("categories").select("*").eq("user_id", profile.user_id),
      ]);

      const totalIncome = (income || []).reduce((s: number, i: Record<string, unknown>) => s + Number(i.amount), 0);
      const totalExpenses = (expenses || []).reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);
      const balance = totalIncome - totalExpenses;
      const savingsRateNum = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

      const catBreakdown: CatItem[] = (categories || [])
        .map((cat: Record<string, unknown>) => ({
          name: String(cat.name),
          icon: String(cat.icon || "💰"),
          budget: Number(cat.monthly_budget) || 0,
          value: (expenses || [])
            .filter((e: Record<string, unknown>) => e.category_id === cat.id)
            .reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0),
        }))
        .filter((c: CatItem) => c.value > 0)
        .sort((a: CatItem, b: CatItem) => b.value - a.value);

      const hourlyRate = profile.monthly_salary > 0 && profile.work_days_per_week > 0 && profile.work_hours_per_day > 0
        ? profile.monthly_salary / (profile.work_days_per_week * 4.33 * profile.work_hours_per_day)
        : 0;
      const workHoursForExpenses = hourlyRate > 0 ? totalExpenses / hourlyRate : 0;
      const workDaysForExpenses = hourlyRate > 0 ? workHoursForExpenses / profile.work_hours_per_day : 0;

      const insights = generateInsights(totalIncome, totalExpenses, balance, savingsRateNum, catBreakdown, workDaysForExpenses);

      const html = buildWeeklyHtml({
        weekLabel,
        totalIncome,
        totalExpenses,
        balance,
        savingsRateNum,
        catBreakdown,
        workDaysForExpenses,
        workHoursForExpenses,
        hourlyRate,
        incomeCount: (income || []).length,
        expenseCount: (expenses || []).length,
        insights,
      });

      results.push({ email, totalIncome, totalExpenses, balance, savingsRate: savingsRateNum.toFixed(1) });

      if (resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            // Change to your verified domain after setup: noreply@financaspro.app
            from: "FinançasPro <onboarding@resend.dev>",
            to: [email],
            subject: `💰 Resumo Semanal — ${weekLabel}`,
            html,
          }),
        });
        const resData = await res.json();
        if (!res.ok) {
          console.error(`Resend error for ${email}:`, JSON.stringify(resData));
        } else {
          console.log(`Weekly email sent to ${email}: ${resData.id}`);
        }
      } else {
        console.log(`RESEND_API_KEY not set — skipped email for ${email}`);
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
