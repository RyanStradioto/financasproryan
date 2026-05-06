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

function getNextMonthlySend(now = new Date()): string {
  let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12, 0, 0));
  if (now >= next) next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12, 0, 0));
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

interface CatItem { name: string; icon: string; value: number; budget: number; }
interface TxItem  { description: string; amount: number; category: string; date: string; }
interface AccItem { name: string; icon: string; balance: number; }

function monthLabel(year: number, month: number): string {
  const raw = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function getMonthRange(monthsAgo: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const year  = d.getFullYear();
  const month = d.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    year, month, daysInMonth,
    label: monthLabel(year, month),
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate:   `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`,
    monthKey:  `${year}-${String(month).padStart(2, "0")}`,
  };
}

function generateMonthlyInsights(
  totalIncome: number,
  totalExpenses: number,
  balance: number,
  savingsRate: number,
  avgDaily: number,
  categories: CatItem[],
  prevExpenses: number,
  prevIncome: number,
): string[] {
  const tips: string[] = [];

  /* BalanÃ§o geral */
  if (balance < 0) {
    tips.push(`O mes fechou no negativo em ${fmt(Math.abs(balance))}. Para o proximo mes, defina limites por categoria antes de gastar.`);
  } else if (savingsRate >= 20) {
    tips.push(`Excelente: voce poupou ${savingsRate.toFixed(1)}% da receita este mes. Isso e acima do recomendado de 20%.`);
  } else if (savingsRate >= 10) {
    tips.push(`Taxa de poupanca de ${savingsRate.toFixed(1)}%. Boa, mas ainda ha espaco para chegar aos 20% recomendados.`);
  } else if (totalIncome > 0) {
    tips.push(`A taxa de poupanca ficou em apenas ${savingsRate.toFixed(1)}%. Identifique categorias com maior potencial de corte.`);
  }

  /* Comparativo com mes anterior */
  if (prevExpenses > 0) {
    const delta = totalExpenses - prevExpenses;
    const deltaPct = Math.abs((delta / prevExpenses) * 100).toFixed(1);
    if (delta > 0) {
      tips.push(`As despesas aumentaram ${deltaPct}% em relacao ao mes anterior (${fmt(prevExpenses)}). Verifique o que mudou.`);
    } else if (delta < 0) {
      tips.push(`Otimo: voce reduziu as despesas em ${deltaPct}% comparado ao mes anterior. Continue no controle.`);
    }
  }

  /* Categorias acima do orcamento */
  const overBudget = categories.filter((c) => c.budget > 0 && c.value > c.budget);
  if (overBudget.length > 0) {
    const names = overBudget.slice(0, 3).map((c) => c.name).join(", ");
    tips.push(`Categorias acima do orcamento: ${names}. Revise os limites ou reduza gastos nessas areas.`);
  }

  /* Categoria dominante */
  if (categories.length > 0 && totalExpenses > 0) {
    const top = categories[0];
    const pct = Math.round((top.value / totalExpenses) * 100);
    if (pct > 35) {
      tips.push(`${top.name} representou ${pct}% das despesas do mes. Pequenos ajustes nessa categoria geram grande impacto no saldo.`);
    }
  }

  /* Media diaria */
  if (avgDaily > 0) {
    tips.push(`Voce gastou em media ${fmt(avgDaily)} por dia este mes.`);
  }

  if (tips.length === 0) {
    tips.push("Mes equilibrado. Continue registrando todas as transacoes para manter a previsibilidade financeira.");
  }

  return tips.slice(0, 5);
}

// deno-lint-ignore no-explicit-any
function buildMonthlyHtml(p: {
  firstName: string;
  label: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number;
  avgDaily: number;
  expenseCount: number;
  incomeCount: number;
  categories: CatItem[];
  topExpenses: TxItem[];
  accounts: AccItem[];
  insights: string[];
  prevIncome: number;
  prevExpenses: number;
  nextScheduledSend: string;
}): string {
  const balPos       = p.balance >= 0;
  const headerBg     = "#1a0533";
  const accentPurple = "#7c3aed";
  const ratioExpPct  = p.totalIncome > 0
    ? Math.min(Math.round((p.totalExpenses / p.totalIncome) * 100), 100)
    : 100;

  const prevDeltaExp = p.prevExpenses > 0
    ? ((p.totalExpenses - p.prevExpenses) / p.prevExpenses) * 100
    : null;
  const prevDeltaInc = p.prevIncome > 0
    ? ((p.totalIncome - p.prevIncome) / p.prevIncome) * 100
    : null;

  /* â”€â”€ Category rows â”€â”€ */
  const catRows = p.categories.slice(0, 8).map((c) => {
    const pct      = p.totalExpenses > 0 ? Math.round((c.value / p.totalExpenses) * 100) : 0;
    const budgetPct = c.budget > 0 ? Math.min(Math.round((c.value / c.budget) * 100), 100) : 0;
    const over      = c.budget > 0 && c.value > c.budget;
    const barColor  = over ? "#ef4444" : budgetPct > 80 ? "#f59e0b" : accentPurple;
    const remaining = c.budget > 0 ? c.budget - c.value : 0;
    return `
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#1f2937;white-space:nowrap;width:1%;">${c.icon}&nbsp;</td>
        <td style="padding:8px 8px 8px 2px;">
          <div style="font-size:13px;color:#111827;font-weight:600;">${c.name}</div>
          ${c.budget > 0 ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px;">
            Orcamento: ${fmt(c.budget)} &bull; ${over ? `<span style="color:#dc2626;">Excedeu ${fmt(c.value - c.budget)}</span>` : `Disponivel: ${fmt(remaining)}`}
          </div>` : ""}
        </td>
        <td style="padding:8px 0;width:35%;">
          <div style="height:6px;background:#f1f5f9;border-radius:999px;overflow:hidden;">
            <div style="height:6px;width:${Math.min(pct, 100)}%;background:${barColor};border-radius:999px;"></div>
          </div>
          ${c.budget > 0 ? `<div style="height:3px;background:transparent;margin-top:2px;position:relative;">
            <div style="position:absolute;top:0;left:0;height:3px;width:${Math.min(budgetPct,100)}%;background:${barColor}33;border-radius:999px;"></div>
          </div>` : ""}
        </td>
        <td style="padding:8px 0 8px 12px;text-align:right;white-space:nowrap;">
          <div style="font-size:13px;color:${over ? "#dc2626" : "#111827"};font-weight:700;">${fmt(c.value)}</div>
          <div style="font-size:11px;color:#9ca3af;">${pct}%</div>
        </td>
      </tr>`;
  }).join("");

  /* â”€â”€ Top expense rows â”€â”€ */
  const txRows = p.topExpenses.slice(0, 5).map((t, i) => `
    <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#ffffff"};">
      <td style="padding:8px 12px;font-size:13px;color:#111827;">${t.description || "Sem descricao"}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;">${t.category}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;white-space:nowrap;">
        ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(t.date + "T12:00:00"))}
      </td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#dc2626;text-align:right;white-space:nowrap;">${fmt(t.amount)}</td>
    </tr>`).join("");

  /* â”€â”€ Account rows â”€â”€ */
  const accRows = p.accounts.slice(0, 5).map((a) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#1f2937;">${a.icon}&nbsp;&nbsp;${a.name}</td>
      <td style="padding:6px 0;font-size:13px;font-weight:700;color:${a.balance >= 0 ? "#166534" : "#dc2626"};text-align:right;">${fmt(a.balance)}</td>
    </tr>`).join("");

  /* â”€â”€ Insight rows â”€â”€ */
  const insightRows = p.insights.map((t) => `
    <tr>
      <td style="padding:3px 0 3px 4px;vertical-align:top;width:1%;">
        <div style="width:6px;height:6px;background:${accentPurple};border-radius:50%;margin-top:5px;"></div>
      </td>
      <td style="padding:3px 0 10px 10px;font-size:13px;color:#1f2937;line-height:1.6;">${t}</td>
    </tr>`).join("");

  const greeting = p.firstName ? `Ola, ${p.firstName}!` : "Ola!";

  const deltaExpHtml = prevDeltaExp !== null
    ? `<span style="font-size:11px;color:${prevDeltaExp > 0 ? "#dc2626" : "#16a34a"};font-weight:700;">${prevDeltaExp > 0 ? "â–²" : "â–¼"} ${Math.abs(prevDeltaExp).toFixed(1)}% vs. mes ant.</span>`
    : "";
  const deltaIncHtml = prevDeltaInc !== null
    ? `<span style="font-size:11px;color:${prevDeltaInc >= 0 ? "#16a34a" : "#dc2626"};font-weight:700;">${prevDeltaInc >= 0 ? "â–²" : "â–¼"} ${Math.abs(prevDeltaInc).toFixed(1)}% vs. mes ant.</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Relatorio Mensal | FinancasPro</title>
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
              <span style="display:inline-block;background:${accentPurple};color:#fff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:20px;">Relatorio Mensal</span>
              <div style="font-size:26px;font-weight:800;color:#ffffff;margin-top:10px;letter-spacing:-0.5px;">FinancasPro</div>
              <div style="font-size:13px;color:#a78bfa;margin-top:4px;">${greeting} Veja o fechamento completo do seu mes.</div>
            </td>
            <td align="right" valign="top">
              <div style="font-size:15px;color:#e9d5ff;font-weight:700;">${p.label}</div>
              <div style="font-size:11px;color:#7c3aed;margin-top:6px;max-width:180px;text-align:right;">Proximo envio: ${p.nextScheduledSend}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- GRADIENT STRIPE -->
    <tr><td style="height:3px;background:linear-gradient(90deg,${accentPurple},#ec4899,#f59e0b);"></td></tr>

    <!-- MAIN CARDS -->
    <tr>
      <td style="background:#ffffff;padding:24px 28px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="31%" style="padding-right:8px;">
              <div style="border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;padding:14px 16px;">
                <div style="font-size:10px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Receitas</div>
                <div style="font-size:22px;color:#166534;font-weight:800;margin-top:6px;letter-spacing:-0.5px;">${fmt(p.totalIncome)}</div>
                <div style="font-size:11px;color:#4b5563;margin-top:4px;">${p.incomeCount} lancamento${p.incomeCount !== 1 ? "s" : ""}</div>
                <div style="margin-top:4px;">${deltaIncHtml}</div>
              </div>
            </td>
            <td width="31%" style="padding:0 4px;">
              <div style="border-radius:12px;background:#fef2f2;border:1px solid #fecaca;padding:14px 16px;">
                <div style="font-size:10px;color:#b91c1c;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Despesas</div>
                <div style="font-size:22px;color:#991b1b;font-weight:800;margin-top:6px;letter-spacing:-0.5px;">${fmt(p.totalExpenses)}</div>
                <div style="font-size:11px;color:#4b5563;margin-top:4px;">${p.expenseCount} lancamento${p.expenseCount !== 1 ? "s" : ""}</div>
                <div style="margin-top:4px;">${deltaExpHtml}</div>
              </div>
            </td>
            <td width="31%" style="padding-left:8px;">
              <div style="border-radius:12px;background:${balPos ? "#f0fdf4" : "#fef2f2"};border:1px solid ${balPos ? "#bbf7d0" : "#fecaca"};padding:14px 16px;">
                <div style="font-size:10px;color:${balPos ? "#15803d" : "#b91c1c"};font-weight:700;text-transform:uppercase;letter-spacing:1px;">Saldo</div>
                <div style="font-size:22px;color:${balPos ? "#166534" : "#991b1b"};font-weight:800;margin-top:6px;letter-spacing:-0.5px;">${fmt(p.balance)}</div>
                <div style="font-size:11px;color:${p.savingsRate >= 20 ? "#16a34a" : p.savingsRate >= 10 ? "#d97706" : "#dc2626"};margin-top:4px;font-weight:700;">${p.savingsRate.toFixed(1)}% poupado</div>
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
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;" width="31%" valign="top">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Media/dia</div>
              <div style="font-size:18px;color:#0f172a;font-weight:800;margin-top:4px;">${fmt(p.avgDaily)}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">gastos por dia</div>
            </td>
            <td width="3%"></td>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;" width="31%" valign="top">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Poupanca</div>
              <div style="font-size:18px;color:${p.savingsRate >= 20 ? "#166534" : p.savingsRate >= 10 ? "#92400e" : "#991b1b"};font-weight:800;margin-top:4px;">${p.savingsRate.toFixed(1)}%</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">meta: 20%</div>
            </td>
            <td width="3%"></td>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;" width="31%" valign="top">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Despesas vs Rec.</div>
              <div style="font-size:18px;color:${ratioExpPct > 90 ? "#991b1b" : ratioExpPct > 70 ? "#92400e" : "#166534"};font-weight:800;margin-top:4px;">${ratioExpPct}%</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">do total recebido</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- RATIO BAR -->
    <tr>
      <td style="background:#ffffff;padding:0 28px 20px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:12px;font-weight:600;color:#374151;">Orcamento do mes â€” Despesas x Receitas</td>
              <td align="right" style="font-size:12px;font-weight:700;color:${ratioExpPct > 90 ? "#dc2626" : ratioExpPct > 70 ? "#d97706" : "#16a34a"};">${ratioExpPct}% comprometido</td>
            </tr>
          </table>
          <div style="height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-top:8px;">
            <div style="height:10px;width:${ratioExpPct}%;background:${ratioExpPct > 90 ? "linear-gradient(90deg,#ef4444,#dc2626)" : ratioExpPct > 70 ? "linear-gradient(90deg,#f59e0b,#d97706)" : "linear-gradient(90deg,#10b981,#059669)"};border-radius:999px;"></div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
            <tr>
              <td style="font-size:11px;color:#16a34a;">&#x2714; Receitas: ${fmt(p.totalIncome)}</td>
              <td align="right" style="font-size:11px;color:#dc2626;">Despesas: ${fmt(p.totalExpenses)}</td>
            </tr>
          </table>
        </div>
      </td>
    </tr>

    <!-- CATEGORIES -->
    ${p.categories.length > 0 ? `
    <tr>
      <td style="background:#ffffff;padding:0 28px 20px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:16px;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">&#x1F4CA; Categorias do mes</div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Gasto real vs. orcamento mensal por categoria</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${catRows}
          </table>
        </div>
      </td>
    </tr>` : ""}

    <!-- TOP EXPENSES -->
    ${txRows ? `
    <tr>
      <td style="background:#ffffff;padding:0 28px 20px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:16px;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">&#x1F4B8; Maiores despesas do mes</div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Top 5 maiores gastos registrados</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:10px;overflow:hidden;border:1px solid #f1f5f9;">
            <tr style="background:#f8fafc;">
              <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Descricao</th>
              <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Categoria</th>
              <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Data</th>
              <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Valor</th>
            </tr>
            ${txRows}
          </table>
        </div>
      </td>
    </tr>` : ""}

    <!-- ACCOUNTS -->
    ${p.accounts.length > 0 ? `
    <tr>
      <td style="background:#ffffff;padding:0 28px 20px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:16px;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:12px;">&#x1F3E6; Saldo das contas</div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              ${accRows}
            </table>
          </div>
        </div>
      </td>
    </tr>` : ""}

    <!-- INSIGHTS -->
    ${p.insights.length > 0 ? `
    <tr>
      <td style="background:#ffffff;padding:0 28px 24px;">
        <div style="background:#faf5ff;border-left:3px solid ${accentPurple};border-radius:0 10px 10px 0;padding:16px 18px;">
          <div style="font-size:13px;font-weight:700;color:#6d28d9;margin-bottom:10px;">&#x1F9E0; Analise e recomendacoes</div>
          <table cellpadding="0" cellspacing="0" border="0">
            ${insightRows}
          </table>
        </div>
      </td>
    </tr>` : ""}

    <!-- FOOTER -->
    <tr>
      <td style="background:#1a0533;border-radius:0 0 16px 16px;padding:18px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:12px;color:#4c1d95;">
              <strong style="color:#a78bfa;">FinancasPro</strong> &mdash; Relatorio automatico mensal<br/>
              <span style="color:#374151;color:#6d28d9;">Para ajustar suas preferencias de email, acesse Configuracoes no app.</span>
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
    const brevoApiKey     = Deno.env.get("BREVO_API_KEY");
    const dataUrl         = Deno.env.get("DATA_SUPABASE_URL")         || Deno.env.get("SUPABASE_URL")!;
    const dataAnonKey     = Deno.env.get("DATA_SUPABASE_ANON_KEY")     || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dataServiceRole = Deno.env.get("DATA_SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret      = Deno.env.get("CRON_SECRET");

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
        .select("user_id,first_name,monthly_summary_enabled")
        .eq("monthly_summary_enabled", true);
      if (error) throw error;
      if (!profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ message: "No users with monthly summary enabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const p of profiles) {
        const { data: ud } = await adminClient.auth.admin.getUserById(p.user_id);
        if (ud?.user?.email) profilesToProcess.push({ user_id: p.user_id, email: ud.user.email, first_name: p.first_name });
      }
    }

    const reportRange = getMonthRange(1); // previous month
    const prevRange   = getMonthRange(2); // month before that
    const nextScheduledSend = getNextMonthlySend();
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

      const [incRes, expRes, catRes, prevIncRes, prevExpRes, accRes, cardEqRes] = await Promise.all([
        dc.from("income").select("id,amount,date,description,account_id")
          .eq("user_id", profile.user_id).gte("date", reportRange.startDate).lte("date", reportRange.endDate),
        dc.from("expenses").select("id,amount,date,description,category_id")
          .eq("user_id", profile.user_id).gte("date", reportRange.startDate).lte("date", reportRange.endDate),
        dc.from("categories").select("id,name,icon,monthly_budget").eq("user_id", profile.user_id),
        dc.from("income").select("amount")
          .eq("user_id", profile.user_id).gte("date", prevRange.startDate).lte("date", prevRange.endDate),
        dc.from("expenses").select("amount")
          .eq("user_id", profile.user_id).gte("date", prevRange.startDate).lte("date", prevRange.endDate),
        dc.from("accounts").select("id,name,icon,initial_balance").eq("user_id", profile.user_id),
        dc.from("credit_card_transactions").select("id,amount,date,bill_month,category_id,description")
          .eq("user_id", profile.user_id).eq("bill_month", reportRange.monthKey),
      ]);

      const income     = incRes.data  || [];
      const expenses   = expRes.data  || [];
      const categories = catRes.data  || [];
      const prevIncome = prevIncRes.data || [];
      const prevExp    = prevExpRes.data || [];
      const accounts   = accRes.data  || [];
      const cardTx     = cardEqRes.data || [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalIncome    = income.reduce((s: number, i: Record<string, unknown>)   => s + Number(i.amount), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalExpenses  = expenses.reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0)
                           // eslint-disable-next-line @typescript-eslint/no-explicit-any
                           + cardTx.reduce((s: number, e: Record<string, unknown>)   => s + Number(e.amount), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prevTotalInc   = prevIncome.reduce((s: number, i: Record<string, unknown>) => s + Number(i.amount), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prevTotalExp   = prevExp.reduce((s: number, e: Record<string, unknown>)    => s + Number(e.amount), 0);
      const balance        = totalIncome - totalExpenses;
      const savingsRate    = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
      const avgDaily       = reportRange.daysInMonth > 0 ? totalExpenses / reportRange.daysInMonth : 0;

      /* Category breakdown */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catMap = new Map<string, CatItem>();
      for (const cat of categories) {
        catMap.set(String(cat.id), { name: String(cat.name), icon: String(cat.icon || "ðŸ·ï¸"), budget: Number(cat.monthly_budget) || 0, value: 0 });
      }
      const allExp = [...expenses, ...cardTx];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const e of allExp) {
        const c = catMap.get(String(e.category_id));
        if (c) c.value += Number(e.amount);
      }
      const catBreakdown: CatItem[] = Array.from(catMap.values())
        .filter((c) => c.value > 0).sort((a, b) => b.value - a.value);

      /* Top expenses */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catNameMap = new Map(categories.map((c: Record<string, unknown>) => [String(c.id), `${c.icon || ""} ${c.name}`]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topExpenses: TxItem[] = [...allExp]
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.amount) - Number(a.amount))
        .slice(0, 5)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: Record<string, unknown>) => ({
          description: String(e.description || ""),
          amount: Number(e.amount),
          category: String(catNameMap.get(String(e.category_id)) || "Sem categoria"),
          date: String(e.date),
        }));

      /* Account balances (initial_balance as proxy â€” good enough for summary) */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accItems: AccItem[] = accounts.map((a: any) => ({
        name: String(a.name),
        icon: String(a.icon || "ðŸ¦"),
        balance: Number(a.initial_balance) || 0,
      })).sort((a: AccItem, b: AccItem) => b.balance - a.balance);

      const insights = generateMonthlyInsights(
        totalIncome, totalExpenses, balance, savingsRate, avgDaily,
        catBreakdown, prevTotalExp, prevTotalInc
      );

      const html = buildMonthlyHtml({
        firstName: profile.first_name || "",
        label: reportRange.label,
        totalIncome, totalExpenses, balance, savingsRate, avgDaily,
        expenseCount: expenses.length + cardTx.length,
        incomeCount: income.length,
        categories: catBreakdown,
        topExpenses,
        accounts: accItems,
        insights,
        prevIncome: prevTotalInc,
        prevExpenses: prevTotalExp,
        nextScheduledSend,
      });

      results.push({ email: profile.email, totalIncome, totalExpenses, balance, savingsRate: savingsRate.toFixed(1) });

      if (brevoApiKey) {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": brevoApiKey },
          body: JSON.stringify({
            sender: { name: "FinancasPro", email: "amaralstradiotoryan@gmail.com" },
            to: [{ email: profile.email }],
            subject: `ðŸ“… Relatorio Mensal | ${reportRange.label}`,
            htmlContent: html,
          }),
        });
        const resData = await res.json();
        if (!res.ok) console.error(`Brevo error for ${profile.email}:`, JSON.stringify(resData));
      }
    }

    return new Response(JSON.stringify({ success: true, month: reportRange.label, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in monthly-summary:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

