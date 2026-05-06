import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatScheduleDate(date: Date): string {
  const weekday = normalizeText(
    new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" }).format(date)
  );
  const day = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo",
  }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo",
  }).format(date);
  return `${weekday}, ${day} as ${time}`;
}

function getNextWeeklySend(now = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  let daysUntilMonday = (1 - next.getUTCDay() + 7) % 7;
  if (daysUntilMonday === 0 && now >= next) daysUntilMonday = 7;
  next.setUTCDate(next.getUTCDate() + daysUntilMonday);
  return formatScheduleDate(next);
}

function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch { return null; }
}

interface CatItem   { name: string; icon: string; value: number; budget: number; }
interface TxItem    { description: string; amount: number; category: string; date: string; }

function dayLabel(dateStr: string): string {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const [y, m, d] = dateStr.split("-").map(Number);
  return days[new Date(y, m - 1, d).getDay()];
}

function generateWeeklyInsights(
  totalIncome: number,
  totalExpenses: number,
  balance: number,
  avgDaily: number,
  categories: CatItem[],
  projectedMonthly: number,
): string[] {
  const tips: string[] = [];

  if (totalIncome === 0 && totalExpenses === 0) {
    tips.push("Nenhuma transacao registrada nesta semana. Mantenha o habito de lancar receitas e despesas para ter controle real.");
    return tips;
  }

  if (balance < 0) {
    tips.push(`Esta semana fechou no negativo em ${fmt(Math.abs(balance))}. Revise os gastos para reequilibrar nas proximas semanas.`);
  } else if (totalIncome > 0 && balance / totalIncome >= 0.2) {
    tips.push(`Semana positiva: voce poupou ${((balance / totalIncome) * 100).toFixed(0)}% do que recebeu. Continue assim.`);
  } else if (totalIncome > 0) {
    tips.push(`Voce gastou ${((totalExpenses / totalIncome) * 100).toFixed(0)}% da receita desta semana. Tente manter abaixo de 80%.`);
  }

  if (projectedMonthly > 0) {
    tips.push(`No ritmo atual, sua projecao de gastos para o mes e de ${fmt(projectedMonthly)}. Compare com seu salario para ajustar.`);
  }

  const overBudget = categories.filter((c) => c.budget > 0 && c.value > c.budget * 0.3);
  if (overBudget.length > 0) {
    const names = overBudget.slice(0, 2).map((c) => c.name).join(", ");
    tips.push(`${names} ja consumiu uma parcela relevante do orcamento mensal nesta semana.`);
  }

  if (categories.length > 0 && totalExpenses > 0) {
    const top = categories[0];
    const pct = Math.round((top.value / totalExpenses) * 100);
    if (pct > 40) {
      tips.push(`${top.name} concentrou ${pct}% das despesas da semana. Verifique se houve algum gasto pontual ou padrao recorrente.`);
    }
  }

  if (avgDaily > 0) {
    tips.push(`Media diaria de gastos: ${fmt(avgDaily)} por dia nesta semana.`);
  }

  return tips.slice(0, 4);
}

// deno-lint-ignore no-explicit-any
function buildWeeklyHtml(p: {
  firstName: string;
  weekLabel: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  avgDaily: number;
  projectedMonthly: number;
  categories: CatItem[];
  topExpenses: TxItem[];
  insights: string[];
  incomeCount: number;
  expenseCount: number;
  nextScheduledSend: string;
}): string {
  const balancePositive = p.balance >= 0;
  const ratioExpPct = p.totalIncome > 0
    ? Math.min(Math.round((p.totalExpenses / p.totalIncome) * 100), 100)
    : 100;

  const headerBg   = "#0d1b2a";
  const accentBlue = "#3b82f6";

  /* â”€â”€ Category rows â”€â”€ */
  const catRows = p.categories.slice(0, 6).map((c) => {
    const pct    = p.totalExpenses > 0 ? Math.round((c.value / p.totalExpenses) * 100) : 0;
    const barPct = Math.min(pct, 100);
    const barColor = pct > 60 ? "#ef4444" : pct > 35 ? "#f59e0b" : accentBlue;
    return `
      <tr>
        <td style="padding:7px 0;font-size:13px;color:#1f2937;white-space:nowrap;width:1%;">${c.icon}&nbsp;</td>
        <td style="padding:7px 8px 7px 2px;font-size:13px;color:#1f2937;">${c.name}</td>
        <td style="padding:7px 0;width:45%;">
          <div style="height:7px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
            <div style="height:7px;width:${barPct}%;background:${barColor};border-radius:999px;"></div>
          </div>
        </td>
        <td style="padding:7px 0 7px 12px;font-size:12px;color:#374151;text-align:right;white-space:nowrap;">
          ${fmt(c.value)} <span style="color:#9ca3af;">(${pct}%)</span>
        </td>
      </tr>`;
  }).join("");

  /* â”€â”€ Top expense rows â”€â”€ */
  const txRows = p.topExpenses.slice(0, 5).map((t, i) => `
    <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#ffffff"};">
      <td style="padding:8px 12px;font-size:13px;color:#111827;">${t.description || "Sem descricao"}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;">${t.category}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;white-space:nowrap;">${dayLabel(t.date)}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#dc2626;text-align:right;white-space:nowrap;">${fmt(t.amount)}</td>
    </tr>`).join("");

  /* â”€â”€ Insight rows â”€â”€ */
  const insightRows = p.insights.map((t) => `
    <tr>
      <td style="padding:3px 0 3px 6px;vertical-align:top;">
        <div style="width:6px;height:6px;background:${accentBlue};border-radius:50%;margin-top:5px;"></div>
      </td>
      <td style="padding:3px 0 10px 10px;font-size:13px;color:#1f2937;line-height:1.6;">${t}</td>
    </tr>`).join("");

  const greeting = p.firstName ? `Ola, ${p.firstName}!` : "Ola!";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Resumo Semanal | FinancasPro</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:28px 0;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

    <!-- HEADER -->
    <tr>
      <td style="background:${headerBg};border-radius:16px 16px 0 0;padding:28px 28px 22px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <span style="display:inline-block;background:${accentBlue};color:#fff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:20px;">Resumo Semanal</span>
              <div style="font-size:26px;font-weight:800;color:#ffffff;margin-top:10px;letter-spacing:-0.5px;">FinancasPro</div>
              <div style="font-size:13px;color:#94a3b8;margin-top:4px;">${greeting} Sua semana financeira em um so lugar.</div>
            </td>
            <td align="right" valign="top">
              <div style="font-size:13px;color:#cbd5e1;font-weight:600;">${p.weekLabel}</div>
              <div style="font-size:11px;color:#64748b;margin-top:6px;max-width:180px;text-align:right;">Proximo envio: ${p.nextScheduledSend}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- DIVIDER -->
    <tr><td style="height:3px;background:linear-gradient(90deg,${accentBlue},#06b6d4,#10b981);"></td></tr>

    <!-- CARDS -->
    <tr>
      <td style="background:#ffffff;padding:24px 28px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="31%" style="padding-right:8px;">
              <div style="border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;padding:14px 16px;">
                <div style="font-size:10px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Receitas</div>
                <div style="font-size:22px;color:#166534;font-weight:800;margin-top:6px;letter-spacing:-0.5px;">${fmt(p.totalIncome)}</div>
                <div style="font-size:11px;color:#4b5563;margin-top:4px;">${p.incomeCount} lancamento${p.incomeCount !== 1 ? "s" : ""}</div>
              </div>
            </td>
            <td width="31%" style="padding:0 4px;">
              <div style="border-radius:12px;background:#fef2f2;border:1px solid #fecaca;padding:14px 16px;">
                <div style="font-size:10px;color:#b91c1c;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Despesas</div>
                <div style="font-size:22px;color:#991b1b;font-weight:800;margin-top:6px;letter-spacing:-0.5px;">${fmt(p.totalExpenses)}</div>
                <div style="font-size:11px;color:#4b5563;margin-top:4px;">${p.expenseCount} lancamento${p.expenseCount !== 1 ? "s" : ""}</div>
              </div>
            </td>
            <td width="31%" style="padding-left:8px;">
              <div style="border-radius:12px;background:${balancePositive ? "#f0fdf4" : "#fef2f2"};border:1px solid ${balancePositive ? "#bbf7d0" : "#fecaca"};padding:14px 16px;">
                <div style="font-size:10px;color:${balancePositive ? "#15803d" : "#b91c1c"};font-weight:700;text-transform:uppercase;letter-spacing:1px;">Saldo</div>
                <div style="font-size:22px;color:${balancePositive ? "#166534" : "#991b1b"};font-weight:800;margin-top:6px;letter-spacing:-0.5px;">${fmt(p.balance)}</div>
                <div style="font-size:11px;color:${balancePositive ? "#16a34a" : "#dc2626"};margin-top:4px;">${balancePositive ? "Semana positiva âœ“" : "Semana negativa"}</div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- SECONDARY METRICS -->
    <tr>
      <td style="background:#ffffff;padding:0 28px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;" width="48%">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Media diaria</div>
              <div style="font-size:18px;color:#0f172a;font-weight:800;margin-top:4px;">${fmt(p.avgDaily)}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">de gastos por dia</div>
            </td>
            <td width="4%"></td>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;" width="48%">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Projecao mensal</div>
              <div style="font-size:18px;color:#0f172a;font-weight:800;margin-top:4px;">${fmt(p.projectedMonthly)}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">no ritmo atual</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- RATIO BAR -->
    ${p.totalIncome > 0 || p.totalExpenses > 0 ? `
    <tr>
      <td style="background:#ffffff;padding:0 28px 20px;">
        <div style="background:#f1f5f9;border-radius:10px;padding:14px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:12px;font-weight:600;color:#374151;">Despesas vs Receitas</td>
              <td align="right" style="font-size:12px;font-weight:700;color:${ratioExpPct > 90 ? "#dc2626" : ratioExpPct > 70 ? "#d97706" : "#16a34a"};">${ratioExpPct}% gasto</td>
            </tr>
          </table>
          <div style="height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:8px;">
            <div style="height:8px;width:${ratioExpPct}%;background:${ratioExpPct > 90 ? "#ef4444" : ratioExpPct > 70 ? "#f59e0b" : "#10b981"};border-radius:999px;"></div>
          </div>
          <div style="margin-top:6px;font-size:11px;color:#94a3b8;">
            ${fmt(p.totalExpenses)} de ${fmt(p.totalIncome)} recebidos esta semana
          </div>
        </div>
      </td>
    </tr>` : ""}

    <!-- SECTION DIVIDER -->
    <tr><td style="background:#ffffff;padding:0 28px 4px;">
      <div style="height:1px;background:#f1f5f9;"></div>
    </td></tr>

    <!-- CATEGORIES -->
    ${p.categories.length > 0 ? `
    <tr>
      <td style="background:#ffffff;padding:16px 28px;">
        <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">&#x1F4CA; Categorias da semana</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Distribuicao dos gastos por categoria</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${catRows}
        </table>
      </td>
    </tr>` : ""}

    <!-- TOP EXPENSES -->
    ${txRows ? `
    <tr>
      <td style="background:#ffffff;padding:8px 28px 20px;">
        <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">&#x1F4B8; Maiores gastos da semana</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">As 5 maiores despesas registradas</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:10px;overflow:hidden;border:1px solid #f1f5f9;">
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Descricao</th>
            <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Categoria</th>
            <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Dia</th>
            <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Valor</th>
          </tr>
          ${txRows}
        </table>
      </td>
    </tr>` : ""}

    <!-- INSIGHTS -->
    ${p.insights.length > 0 ? `
    <tr>
      <td style="background:#ffffff;padding:0 28px 24px;">
        <div style="background:#eff6ff;border-left:3px solid ${accentBlue};border-radius:0 10px 10px 0;padding:16px 18px;">
          <div style="font-size:13px;font-weight:700;color:#1e40af;margin-bottom:10px;">&#x1F9E0; Analise da semana</div>
          <table cellpadding="0" cellspacing="0" border="0">
            ${insightRows}
          </table>
        </div>
      </td>
    </tr>` : ""}

    <!-- FOOTER -->
    <tr>
      <td style="background:#0f172a;border-radius:0 0 16px 16px;padding:18px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:12px;color:#475569;">
              <strong style="color:#94a3b8;">FinancasPro</strong> &mdash; Resumo automatico semanal<br/>
              <span style="color:#334155;">Para ajustar suas preferencias de email, acesse Configuracoes no app.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const brevoApiKey      = Deno.env.get("BREVO_API_KEY");
    const dataUrl          = Deno.env.get("DATA_SUPABASE_URL")          || Deno.env.get("SUPABASE_URL")!;
    const dataAnonKey      = Deno.env.get("DATA_SUPABASE_ANON_KEY")      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dataServiceRole  = Deno.env.get("DATA_SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret       = Deno.env.get("CRON_SECRET");

    const authHeader        = req.headers.get("Authorization");
    const userJwt           = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const jwtPayload        = decodeJwtPayload(userJwt);
    const isServiceRoleToken =
      userJwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      userJwt === dataServiceRole ||
      (jwtPayload?.role === "service_role" && jwtPayload?.ref === "gashcjenhwamgxrrmbsa");
    const isCronSecretCall  = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
    const isServiceRoleCall = Boolean(isServiceRoleToken || isCronSecretCall);

    if (!isServiceRoleCall && !userJwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    interface ProfileEntry { user_id: string; email: string; first_name?: string; }
    let profilesToProcess: ProfileEntry[] = [];

    if (!isServiceRoleCall && userJwt) {
      const dc = createClient(dataUrl, dataAnonKey, {
        global: { headers: { Authorization: `Bearer ${userJwt}` } },
        auth: { persistSession: false },
      });
      const { data: { user } } = await dc.auth.getUser();
      if (!user?.email) return new Response(JSON.stringify({ error: "Could not identify user" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const { data: prof } = await dc.from("profiles").select("first_name").eq("user_id", user.id).maybeSingle();
      profilesToProcess = [{ user_id: user.id, email: user.email, first_name: prof?.first_name }];
    } else {
      const adminKey = dataServiceRole || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminUrl = dataServiceRole ? dataUrl : Deno.env.get("SUPABASE_URL")!;
      const adminClient = createClient(adminUrl, adminKey);
      const { data: profiles, error } = await adminClient
        .from("profiles")
        .select("user_id,first_name,weekly_summary_enabled")
        .eq("weekly_summary_enabled", true);
      if (error) throw error;
      if (!profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ message: "No users with weekly summary enabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const p of profiles) {
        const { data: ud } = await adminClient.auth.admin.getUserById(p.user_id);
        if (ud?.user?.email) profilesToProcess.push({ user_id: p.user_id, email: ud.user.email, first_name: p.first_name });
      }
    }

    /* â”€â”€ Date range: last 7 days â”€â”€ */
    const now      = new Date();
    const rangeEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const rangeStart = new Date(rangeEnd);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 6);
    const startDate = rangeStart.toISOString().split("T")[0];
    const endDate   = rangeEnd.toISOString().split("T")[0];
    const fmt2 = (d: Date) => new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo",
    }).format(d);
    const weekLabel = `${fmt2(rangeStart)} a ${fmt2(rangeEnd)}`;
    const nextScheduledSend = getNextWeeklySend(now);

    const results = [];

    for (const profile of profilesToProcess) {
      if (!profile.email) continue;

      const clientKey = dataServiceRole || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const clientUrl = dataServiceRole ? dataUrl : Deno.env.get("SUPABASE_URL")!;
      const dc = isServiceRoleCall
        ? createClient(clientUrl, clientKey)
        : createClient(dataUrl, dataAnonKey, {
            global: { headers: { Authorization: `Bearer ${userJwt}` } },
            auth: { persistSession: false },
          });

      const [incRes, expRes, catRes] = await Promise.all([
        dc.from("income").select("id,amount,date,description,account_id")
          .eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate),
        dc.from("expenses").select("id,amount,date,description,category_id,status")
          .eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate),
        dc.from("categories").select("id,name,icon,monthly_budget").eq("user_id", profile.user_id),
      ]);

      if (incRes.error) throw incRes.error;
      if (expRes.error) throw expRes.error;

      const income     = incRes.data  || [];
      const expenses   = expRes.data  || [];
      const categories = catRes.data  || [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalIncome   = income.reduce((s: number, i: Record<string, unknown>)   => s + Number(i.amount), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalExpenses = expenses.reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);
      const balance       = totalIncome - totalExpenses;
      const avgDaily      = totalExpenses / 7;
      const projectedMonthly = avgDaily * 30;

      /* Category breakdown */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catMap = new Map<string, CatItem>();
      for (const cat of categories) {
        catMap.set(String(cat.id), { name: String(cat.name), icon: String(cat.icon || "ðŸ·ï¸"), budget: Number(cat.monthly_budget) || 0, value: 0 });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const e of expenses) {
        const c = catMap.get(String(e.category_id));
        if (c) c.value += Number(e.amount);
      }
      const catBreakdown: CatItem[] = Array.from(catMap.values())
        .filter((c) => c.value > 0)
        .sort((a, b) => b.value - a.value);

      /* Top expenses */
      const catNameMap = new Map(categories.map((c: Record<string, unknown>) => [String(c.id), `${c.icon || ""} ${c.name}`]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topExpenses: TxItem[] = [...expenses]
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.amount) - Number(a.amount))
        .slice(0, 5)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: Record<string, unknown>) => ({
          description: String(e.description || ""),
          amount: Number(e.amount),
          category: String(catNameMap.get(String(e.category_id)) || "Sem categoria"),
          date: String(e.date),
        }));

      const insights = generateWeeklyInsights(totalIncome, totalExpenses, balance, avgDaily, catBreakdown, projectedMonthly);

      const html = buildWeeklyHtml({
        firstName: profile.first_name || "",
        weekLabel,
        totalIncome,
        totalExpenses,
        balance,
        avgDaily,
        projectedMonthly,
        categories: catBreakdown,
        topExpenses,
        insights,
        incomeCount: income.length,
        expenseCount: expenses.length,
        nextScheduledSend,
      });

      results.push({ email: profile.email, totalIncome, totalExpenses, balance });

      if (brevoApiKey) {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": brevoApiKey },
          body: JSON.stringify({
            sender: { name: "FinancasPro", email: "amaralstradiotoryan@gmail.com" },
            to: [{ email: profile.email }],
            subject: `ðŸ“Š Resumo da Semana | ${weekLabel}`,
            htmlContent: html,
          }),
        });
        const resData = await res.json();
        if (!res.ok) console.error(`Brevo error for ${profile.email}:`, JSON.stringify(resData));
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in weekly-summary:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

