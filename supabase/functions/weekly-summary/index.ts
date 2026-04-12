import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all users with weekly summary enabled
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

    const results = [];

    for (const profile of profiles) {
      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
      if (!userData?.user?.email) continue;

      const email = userData.user.email;

      // Get income for the week
      const { data: income = [] } = await supabase
        .from("income")
        .select("*")
        .eq("user_id", profile.user_id)
        .gte("date", startDate)
        .lte("date", endDate);

      // Get expenses for the week
      const { data: expenses = [] } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", profile.user_id)
        .gte("date", startDate)
        .lte("date", endDate);

      // Get categories
      const { data: categories = [] } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", profile.user_id);

      const totalIncome = (income || []).reduce((s: number, i: Record<string, unknown>) => s + Number(i.amount), 0);
      const totalExpenses = (expenses || []).reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);
      const balance = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : "0";

      // Category breakdown
      const catBreakdown = (categories || [])
        .map((cat: Record<string, unknown>) => ({
          name: cat.name,
          icon: cat.icon,
          value: (expenses || []).filter((e: Record<string, unknown>) => e.category_id === cat.id).reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0),
        }))
        .filter((c: Record<string, unknown>) => c.value > 0)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.value as number) - (a.value as number));

      // Work time calculation
      const hourlyRate = profile.monthly_salary > 0
        ? profile.monthly_salary / (profile.work_days_per_week * 4.33 * profile.work_hours_per_day)
        : 0;

      const workHoursForExpenses = hourlyRate > 0 ? (totalExpenses / hourlyRate) : 0;
      const workDaysForExpenses = hourlyRate > 0 ? (workHoursForExpenses / profile.work_hours_per_day) : 0;

      const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

      const weekLabel = `${startDate.split("-").reverse().join("/")} a ${endDate.split("-").reverse().join("/")}`;

      // Build HTML email
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:#111;border-radius:16px;padding:32px;border:1px solid #222;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#10b981;font-size:24px;margin:0;">💰 FinançasPro</h1>
      <p style="color:#888;font-size:14px;margin:8px 0 0;">Resumo Semanal</p>
      <p style="color:#666;font-size:12px;margin:4px 0 0;">${weekLabel}</p>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <div style="flex:1;background:#0d1f17;border-radius:12px;padding:16px;text-align:center;">
        <p style="color:#10b981;font-size:11px;margin:0;text-transform:uppercase;letter-spacing:1px;">Receitas</p>
        <p style="color:#10b981;font-size:22px;font-weight:bold;margin:8px 0 0;">${formatBRL(totalIncome)}</p>
        <p style="color:#666;font-size:11px;margin:4px 0 0;">${(income || []).length} lançamentos</p>
      </div>
      <div style="flex:1;background:#1f0d0d;border-radius:12px;padding:16px;text-align:center;">
        <p style="color:#ef4444;font-size:11px;margin:0;text-transform:uppercase;letter-spacing:1px;">Despesas</p>
        <p style="color:#ef4444;font-size:22px;font-weight:bold;margin:8px 0 0;">${formatBRL(totalExpenses)}</p>
        <p style="color:#666;font-size:11px;margin:4px 0 0;">${(expenses || []).length} lançamentos</p>
      </div>
    </div>

    <div style="background:#0a1a12;border:1px solid #1a3a25;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="color:#888;font-size:12px;margin:0;">Saldo da Semana</p>
      <p style="color:${balance >= 0 ? '#10b981' : '#ef4444'};font-size:28px;font-weight:bold;margin:8px 0;">${formatBRL(balance)}</p>
      <p style="color:#888;font-size:12px;margin:0;">Taxa de economia: <strong style="color:#10b981;">${savingsRate}%</strong></p>
    </div>

    ${hourlyRate > 0 ? `
    <div style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 12px;">⏱️ Equivalente em Trabalho</p>
      <p style="color:#e2e8f0;font-size:14px;margin:0;">
        Você precisou trabalhar <strong style="color:#f59e0b;">${workDaysForExpenses.toFixed(1)} dias</strong> 
        (${workHoursForExpenses.toFixed(1)}h) para cobrir suas despesas desta semana.
      </p>
      <p style="color:#64748b;font-size:11px;margin:8px 0 0;">Baseado no seu valor/hora de ${formatBRL(hourlyRate)}</p>
    </div>
    ` : ""}

    ${catBreakdown.length > 0 ? `
    <div style="margin-bottom:24px;">
      <p style="color:#ccc;font-size:14px;font-weight:600;margin:0 0 12px;">📊 Gastos por Categoria</p>
      ${catBreakdown.slice(0, 5).map((cat: Record<string, unknown>, i: number) => {
        const pct = totalExpenses > 0 ? ((cat.value as number / totalExpenses) * 100).toFixed(0) : 0;
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;">
          <span style="color:#aaa;font-size:13px;">${cat.icon} ${cat.name}</span>
          <div style="text-align:right;">
            <span style="color:#eee;font-size:13px;font-weight:600;">${formatBRL(cat.value)}</span>
            <span style="color:#666;font-size:11px;margin-left:8px;">${pct}%</span>
          </div>
        </div>`;
      }).join("")}
    </div>
    ` : ""}

    ${(income || []).length === 0 && (expenses || []).length === 0 ? `
    <div style="text-align:center;padding:24px;">
      <p style="color:#888;font-size:14px;">📝 Nenhuma movimentação nesta semana.</p>
      <p style="color:#666;font-size:12px;">Comece a registrar suas transações para receber resumos detalhados!</p>
    </div>
    ` : ""}

    <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #222;">
      <p style="color:#555;font-size:11px;margin:0;">Este email foi enviado automaticamente pelo FinançasPro</p>
    </div>
  </div>
</div>
</body>
</html>`;

      results.push({ email, totalIncome, totalExpenses, balance });

      // Send email via Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "FinançasPro <noreply@financaspro.app>",
            to: [email],
            subject: `💰 Resumo Semanal — ${weekLabel}`,
            html,
          }),
        });
        const resData = await res.json();
        if (!res.ok) {
          console.error(`Resend error for ${email}:`, resData);
        } else {
          console.log(`Email sent to ${email}:`, resData.id);
        }
      } else {
        console.log(`RESEND_API_KEY not set — email not sent for ${email}`);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating weekly summary:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
