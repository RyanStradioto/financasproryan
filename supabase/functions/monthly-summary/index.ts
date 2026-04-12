import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

interface CatItem { name: string; icon: string; value: number; budget: number }

function monthName(year: number, month: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

function generateMonthlyInsights(
  totalIncome: number,
  totalExpenses: number,
  balance: number,
  savingsRateNum: number,
  catBreakdown: CatItem[],
): string[] {
  const tips: string[] = [];

  if (savingsRateNum < 0) {
    tips.push(`🚨 Mês no negativo! Despesas superaram receitas em <strong>${fmt(Math.abs(balance))}</strong>. No próximo mês, estabeleça um orçamento rígido para as principais categorias.`);
  } else if (savingsRateNum < 10 && totalIncome > 0) {
    const topCat = catBreakdown[0];
    tips.push(`📉 Taxa de poupança mensal de <strong>${savingsRateNum.toFixed(1)}%</strong> — abaixo da meta de 20%. ${topCat ? `Revise os gastos em ${topCat.icon} ${topCat.name} para o próximo mês.` : "Defina orçamentos por categoria."}`);
  } else if (savingsRateNum < 20 && totalIncome > 0) {
    const needed = totalIncome * 0.2 - balance;
    tips.push(`📊 Poupança de <strong>${savingsRateNum.toFixed(1)}%</strong> este mês. Economizar mais <strong>${fmt(needed)}</strong> atingiria os 20% de meta.`);
  } else if (savingsRateNum >= 20) {
    tips.push(`🎉 Excelente! Taxa de poupança de <strong>${savingsRateNum.toFixed(1)}%</strong> este mês. Considere investir o excedente de ${fmt(balance)}.`);
  }

  const overBudget = catBreakdown.filter((c) => c.budget > 0 && c.value > c.budget);
  if (overBudget.length > 0) {
    const names = overBudget.map((c) => {
      const pct = Math.round(((c.value - c.budget) / c.budget) * 100);
      return `${c.icon} ${c.name} (+${pct}%)`;
    }).slice(0, 3).join(", ");
    tips.push(`🔴 Orçamentos estourados: <strong>${names}</strong>. Ajuste os limites ou reduza esses gastos no próximo mês.`);
  }

  const nearBudget = catBreakdown.filter((c) => c.budget > 0 && c.value <= c.budget && c.value / c.budget >= 0.85);
  if (nearBudget.length > 0 && overBudget.length === 0) {
    tips.push(`🟡 <strong>${nearBudget[0].icon} ${nearBudget[0].name}</strong> utilizou ${Math.round((nearBudget[0].value / nearBudget[0].budget) * 100)}% do orçamento. Fique atento no próximo mês.`);
  }

  if (catBreakdown.length > 0 && totalExpenses > 0) {
    const top = catBreakdown[0];
    const topPct = Math.round((top.value / totalExpenses) * 100);
    if (topPct > 35) {
      tips.push(`🔍 ${top.icon} <strong>${top.name}</strong> foi responsável por ${topPct}% das despesas do mês. Uma redução de 20% nessa categoria pouparia ${fmt(top.value * 0.2)}.`);
    }
  }

  if (totalIncome === 0 && totalExpenses > 0) {
    tips.push(`📝 Nenhuma receita registrada este mês. Lembre-se de lançar seus ganhos para ter relatórios precisos.`);
  }

  if (tips.length < 3 && savingsRateNum >= 15) {
    tips.push(`💡 Com consistência, poupando <strong>${fmt(balance)}/mês</strong> você acumula <strong>${fmt(balance * 12)}</strong> em um ano — que tal definir uma meta de investimento?`);
  }

  return tips.slice(0, 5);
}

function buildMonthlyHtml(params: {
  monthLabel: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRateNum: number;
  catBreakdown: CatItem[];
  incomeCount: number;
  expenseCount: number;
  insights: string[];
  topExpenseDay: string;
  avgDailyExpense: number;
}): string {
  const {
    monthLabel, totalIncome, totalExpenses, balance, savingsRateNum,
    catBreakdown, incomeCount, expenseCount, insights, avgDailyExpense,
  } = params;

  const balClr = balance >= 0 ? "#10b981" : "#ef4444";
  const balBg = balance >= 0 ? "#0d1f17" : "#1f0d0d";
  const balBorder = balance >= 0 ? "#1a3a25" : "#3a1a1a";
  const srClr = savingsRateNum >= 20 ? "#10b981" : savingsRateNum >= 10 ? "#f59e0b" : "#ef4444";
  const srLabel = savingsRateNum >= 20 ? "🎯 Meta atingida!" : savingsRateNum >= 10 ? "📈 Quase lá" : "⚠️ Abaixo da meta";

  const budgetCats = catBreakdown.filter((c) => c.budget > 0);

  const categoryRows = catBreakdown.slice(0, 8).map((cat) => {
    const pct = totalExpenses > 0 ? Math.round((cat.value / totalExpenses) * 100) : 0;
    const budgetPct = cat.budget > 0 ? Math.round((cat.value / cat.budget) * 100) : null;
    const overBudget = cat.budget > 0 && cat.value > cat.budget;
    const barColor = overBudget ? "#ef4444" : "#10b981";
    return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #1e1e1e;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="130" style="color:#bbb;font-size:13px;vertical-align:middle;">${cat.icon} ${cat.name}</td>
            <td style="vertical-align:middle;padding:0 10px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="${Math.min(pct, 100)}%" bgcolor="${barColor}" style="background:${barColor};height:8px;border-radius:4px;"></td>
                  <td bgcolor="#2a2a2a" style="background:#2a2a2a;height:8px;border-radius:4px;"></td>
                </tr>
              </table>
            </td>
            <td width="110" align="right" style="vertical-align:middle;white-space:nowrap;">
              <span style="font-size:13px;color:#ddd;font-weight:600;">${fmt(cat.value)}</span>
              ${budgetPct !== null ? `<br><span style="font-size:10px;color:${overBudget ? "#ef4444" : "#555"};">${budgetPct}% do orçto</span>` : `<br><span style="font-size:10px;color:#444;">${pct}% total</span>`}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join("");

  const budgetRows = budgetCats.slice(0, 6).map((cat) => {
    const pct = Math.round((cat.value / cat.budget) * 100);
    const over = cat.value > cat.budget;
    const statusClr = over ? "#ef4444" : pct >= 85 ? "#f59e0b" : "#10b981";
    const statusLabel = over ? `Estourou +${fmt(cat.value - cat.budget)}` : pct >= 85 ? `Quase no limite` : `✓ Dentro do orçamento`;
    return `
    <tr>
      <td style="padding:7px 0;border-bottom:1px solid #1e1e1e;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="130" style="font-size:12px;color:#bbb;">${cat.icon} ${cat.name}</td>
            <td align="center" style="font-size:11px;color:#555;">${fmt(cat.value)} / ${fmt(cat.budget)}</td>
            <td width="130" align="right" style="font-size:11px;color:${statusClr};font-weight:600;">${statusLabel}</td>
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

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Resumo Mensal — FinançasPro</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a">
 <tr><td align="center" style="padding:24px 16px;">
  <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

   <!-- TOP ACCENT -->
   <tr><td style="background:linear-gradient(90deg,#6366f1,#10b981);height:4px;border-radius:8px 8px 0 0;"></td></tr>

   <!-- HEADER -->
   <tr><td bgcolor="#111111" style="background:#111;padding:28px 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
     <tr>
      <td>
       <p style="margin:0;font-size:22px;font-weight:700;color:#e2e8f0;letter-spacing:-0.5px;">📅 FinançasPro</p>
       <p style="margin:4px 0 0;font-size:14px;color:#888;">Relatório Mensal Completo</p>
      </td>
      <td align="right">
       <p style="margin:0;font-size:13px;color:#6366f1;font-weight:600;text-transform:capitalize;">${monthLabel}</p>
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
        <tr><td bgcolor="#0d1f17" style="background:#0d1f17;border:1px solid #1a3a25;border-radius:12px;padding:16px;text-align:center;">
         <p style="margin:0;font-size:10px;color:#10b981;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Receitas</p>
         <p style="margin:8px 0 4px;font-size:20px;font-weight:700;color:#10b981;">${fmt(totalIncome)}</p>
         <p style="margin:0;font-size:11px;color:#555;">${incomeCount} lançamento${incomeCount !== 1 ? "s" : ""}</p>
        </td></tr>
       </table>
      </td>
      <td width="32%" style="padding:0 3px;">
       <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td bgcolor="#1f0d0d" style="background:#1f0d0d;border:1px solid #3a1a1a;border-radius:12px;padding:16px;text-align:center;">
         <p style="margin:0;font-size:10px;color:#ef4444;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Despesas</p>
         <p style="margin:8px 0 4px;font-size:20px;font-weight:700;color:#ef4444;">${fmt(totalExpenses)}</p>
         <p style="margin:0;font-size:11px;color:#555;">~${fmt(avgDailyExpense)}/dia</p>
        </td></tr>
       </table>
      </td>
      <td width="32%" style="padding-left:6px;">
       <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td bgcolor="${balBg}" style="background:${balBg};border:1px solid ${balBorder};border-radius:12px;padding:16px;text-align:center;">
         <p style="margin:0;font-size:10px;color:${balClr};text-transform:uppercase;letter-spacing:1px;font-weight:600;">Saldo</p>
         <p style="margin:8px 0 4px;font-size:20px;font-weight:700;color:${balClr};">${fmt(balance)}</p>
         <p style="margin:0;font-size:11px;color:${srClr};font-weight:600;">${savingsRateNum.toFixed(1)}% poupado</p>
        </td></tr>
       </table>
      </td>
     </tr>
    </table>
   </td></tr>

   <!-- SAVINGS RATE BADGE -->
   <tr><td bgcolor="#111111" style="background:#111;padding:0 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
     <tr><td bgcolor="#1a1a2e" style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:14px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
       <tr>
        <td style="font-size:13px;color:#a5b4fc;">${srLabel}</td>
        <td align="right">
         <span style="font-size:20px;font-weight:700;color:${srClr};">${savingsRateNum.toFixed(1)}%</span>
         <span style="font-size:11px;color:#555;margin-left:6px;">taxa de poupança</span>
        </td>
       </tr>
       <tr>
        <td colspan="2" style="padding-top:8px;">
         <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
           <td width="${Math.min(savingsRateNum, 100)}%" bgcolor="${srClr}" style="background:${srClr};height:6px;border-radius:4px;"></td>
           <td bgcolor="#2a2a4a" style="background:#2a2a4a;height:6px;border-radius:4px;"></td>
          </tr>
         </table>
         <p style="margin:4px 0 0;font-size:10px;color:#444;">Meta: 20%</p>
        </td>
       </tr>
      </table>
     </td></tr>
    </table>
   </td></tr>

   ${catBreakdown.length > 0 ? `
   <!-- CATEGORIES -->
   <tr><td bgcolor="#111111" style="background:#111;padding:0 32px 20px;">
    <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#e2e8f0;">📊 Gastos por Categoria</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
     ${categoryRows}
    </table>
   </td></tr>` : ""}

   ${budgetCats.length > 0 ? `
   <!-- BUDGET ADHERENCE -->
   <tr><td bgcolor="#111111" style="background:#111;padding:0 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
     <tr><td bgcolor="#111827" style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:16px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#94a3b8;">📋 Aderência ao Orçamento</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
       ${budgetRows}
      </table>
     </td></tr>
    </table>
   </td></tr>` : ""}

   ${insights.length > 0 ? `
   <!-- INSIGHTS -->
   <tr><td bgcolor="#111111" style="background:#111;padding:0 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
     <tr><td bgcolor="#0f1f2f" style="background:#0f1f2f;border:1px solid #1e3a5f;border-radius:12px;padding:18px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#60a5fa;">💡 Análise e Dicas para o Próximo Mês</p>
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
       <p style="margin:0;font-size:11px;color:#444;">Relatório mensal gerado automaticamente pelo <strong style="color:#555;">FinançasPro</strong></p>
       <p style="margin:4px 0 0;font-size:10px;color:#333;">Gerencie suas notificações em Configurações → Notificações</p>
      </td>
     </tr>
    </table>
   </td></tr>

   <!-- BOTTOM GRADIENT -->
   <tr><td style="background:linear-gradient(90deg,#6366f1,#10b981);height:2px;border-radius:0 0 8px 8px;"></td></tr>

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

    // Summarize previous month (runs on 1st of each month)
    const now = new Date();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-indexed
    const lastDay = new Date(prevYear, prevMonth, 0).getDate();
    const startDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const endDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const label = monthName(prevYear, prevMonth);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .eq("monthly_summary_enabled", true);

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No users with summary enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      const avgDailyExpense = totalExpenses / lastDay;

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

      // Find day with highest expenses
      const expByDay: Record<string, number> = {};
      for (const e of (expenses || []) as Record<string, unknown>[]) {
        const d = String(e.date).split("T")[0];
        expByDay[d] = (expByDay[d] || 0) + Number(e.amount);
      }
      const topExpenseDay = Object.entries(expByDay).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

      const insights = generateMonthlyInsights(totalIncome, totalExpenses, balance, savingsRateNum, catBreakdown);

      const html = buildMonthlyHtml({
        monthLabel: label,
        totalIncome,
        totalExpenses,
        balance,
        savingsRateNum,
        catBreakdown,
        incomeCount: (income || []).length,
        expenseCount: (expenses || []).length,
        insights,
        topExpenseDay,
        avgDailyExpense,
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
            subject: `📅 Relatório Mensal — ${label}`,
            html,
          }),
        });
        const resData = await res.json();
        if (!res.ok) {
          console.error(`Resend error for ${email}:`, JSON.stringify(resData));
        } else {
          console.log(`Monthly email sent to ${email}: ${resData.id}`);
        }
      } else {
        console.log(`RESEND_API_KEY not set — skipped email for ${email}`);
      }
    }

    return new Response(JSON.stringify({ success: true, month: label, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in monthly-summary:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
