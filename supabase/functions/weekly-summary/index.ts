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

/** Componentes de data/hora no fuso America/Sao_Paulo (para agendamento por usuario). */
function spNowParts(now: Date): { weekday: number; hour: number; day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short", hour: "2-digit", hour12: false,
    day: "2-digit", month: "2-digit", year: "numeric",
  }).formatToParts(now);
  const wk: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let weekday = 1, hour = 9, day = 1, month = 1, year = 2025;
  for (const part of parts) {
    if (part.type === "weekday") weekday = wk[part.value] ?? weekday;
    else if (part.type === "hour") hour = Number(part.value) % 24;
    else if (part.type === "day") day = Number(part.value);
    else if (part.type === "month") month = Number(part.value);
    else if (part.type === "year") year = Number(part.value);
  }
  return { weekday, hour, day, month, year };
}

function getCurrentMonthContext(now = new Date()) {
  const saoPauloNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const year = saoPauloNow.getFullYear();
  const month = saoPauloNow.getMonth() + 1;
  const day = saoPauloNow.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    elapsedDays: Math.max(day, 1),
    daysInMonth,
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function isCreditCardMirrorExpense(notes: unknown): boolean {
  return typeof notes === "string" && notes.includes("[Cartao de credito|");
}

function isBillPaymentExpense(notes: unknown): boolean {
  return typeof notes === "string" && (
    notes.includes("[FATURA_CARTAO]") ||
    notes.includes("[FATURA_CARTAO_ITEM|")
  );
}

function isReportExpense(row: Record<string, unknown>): boolean {
  if (isBillPaymentExpense(row.notes)) return false;
  if (isCreditCardMirrorExpense(row.notes)) return true;
  return row.status === "concluido";
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

interface CatItem      { name: string; icon: string; value: number; budget: number; }
interface TxItem       { description: string; amount: number; category: string; date: string; }
interface AccountItem  { name: string; icon: string; income: number; expenses: number; net: number; }

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
  projectionReady: boolean,
  monthToDateExpenses: number,
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

  if (projectionReady && projectedMonthly > 0) {
    tips.push(`Pelo ritmo do mes ate agora, a tendencia de gastos e ${fmt(projectedMonthly)}. Use como referencia, nao como previsao fechada.`);
  } else if (monthToDateExpenses > 0) {
    tips.push(`Ainda e cedo para projetar o mes com seguranca. Ate agora, o gasto acumulado do mes e ${fmt(monthToDateExpenses)}.`);
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
  projectionReady: boolean;
  monthToDateExpenses: number;
  categories: CatItem[];
  topExpenses: TxItem[];
  accounts: AccountItem[];
  prevWeekIncome: number;
  prevWeekExpenses: number;
  insights: string[];
  incomeCount: number;
  expenseCount: number;
  nextScheduledSend: string;
}): string {
  const balancePositive = p.balance >= 0;
  const ratioExpPct = p.totalIncome > 0
    ? Math.min(Math.round((p.totalExpenses / p.totalIncome) * 100), 100)
    : 100;
  const projectionTitle = p.projectionReady ? "Tendencia do mes" : "Gasto no mes";
  const projectionValue = p.projectionReady ? p.projectedMonthly : p.monthToDateExpenses;
  const projectionNote = p.projectionReady
    ? "baseada no mes atual"
    : "projecao segura apos dia 10";

  const headerBg   = "linear-gradient(135deg,#081624 0%,#0d2b3d 52%,#063b35 100%)";
  const accentBlue = "#3b82f6";

  // Delta vs semana anterior
  const incomeDelta = p.prevWeekIncome > 0
    ? Math.round(((p.totalIncome - p.prevWeekIncome) / p.prevWeekIncome) * 100)
    : null;
  const expensesDelta = p.prevWeekExpenses > 0
    ? Math.round(((p.totalExpenses - p.prevWeekExpenses) / p.prevWeekExpenses) * 100)
    : null;

  // Account rows
  const accountRows = p.accounts.slice(0, 6).map((a) => {
    const netColor = a.net >= 0 ? "#16a34a" : "#dc2626";
    const netSign = a.net >= 0 ? "+" : "";
    return `
      <tr>
        <td style="padding:9px 0;font-size:14px;color:#1f2937;white-space:nowrap;width:1%;">${a.icon}&nbsp;</td>
        <td style="padding:9px 8px 9px 2px;font-size:13px;color:#1f2937;font-weight:600;">${a.name}</td>
        <td style="padding:9px 8px;font-size:12px;color:#15803d;text-align:right;white-space:nowrap;">${a.income > 0 ? "+" + fmt(a.income) : "—"}</td>
        <td style="padding:9px 8px;font-size:12px;color:#dc2626;text-align:right;white-space:nowrap;">${a.expenses > 0 ? "−" + fmt(a.expenses) : "—"}</td>
        <td style="padding:9px 0 9px 8px;font-size:13px;font-weight:700;color:${netColor};text-align:right;white-space:nowrap;">${netSign}${fmt(a.net)}</td>
      </tr>`;
  }).join("");

  /* Category rows */
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

  /* Top expense rows */
  const txRows = p.topExpenses.slice(0, 5).map((t, i) => `
    <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#ffffff"};">
      <td style="padding:8px 12px;font-size:13px;color:#111827;">${t.description || "Sem descricao"}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;">${t.category}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;white-space:nowrap;">${dayLabel(t.date)}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#dc2626;text-align:right;white-space:nowrap;">${fmt(t.amount)}</td>
    </tr>`).join("");

  /* Insight rows */
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
  <style>
    @media screen and (max-width:620px) {
      body { padding: 0 !important; }
      table[width="600"] { width: 100% !important; max-width: 100% !important; }
      td { box-sizing: border-box !important; }
      td[width="31%"], td[width="48%"] { display: block !important; width: 100% !important; padding: 0 0 10px 0 !important; }
      th, td { word-break: break-word !important; }
    }
  </style>
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
                <div style="font-size:11px;color:${balancePositive ? "#16a34a" : "#dc2626"};margin-top:4px;">${balancePositive ? "Semana positiva &#10003;" : "Semana negativa"}</div>
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
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:1px;">${projectionTitle}</div>
              <div style="font-size:18px;color:#0f172a;font-weight:800;margin-top:4px;">${fmt(projectionValue)}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${projectionNote}</div>
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

    <!-- vs SEMANA ANTERIOR -->
    ${(incomeDelta !== null || expensesDelta !== null) ? `
    <tr>
      <td style="background:#ffffff;padding:0 28px 20px;">
        <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:8px;">vs. Semana anterior</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:12px;color:#374151;">Receitas</td>
              <td align="right" style="font-size:13px;font-weight:700;color:${(incomeDelta ?? 0) >= 0 ? '#16a34a' : '#dc2626'};">
                ${incomeDelta !== null ? fmtPct(incomeDelta) : "—"}
              </td>
            </tr>
            <tr>
              <td style="padding-top:4px;font-size:12px;color:#374151;">Despesas</td>
              <td align="right" style="padding-top:4px;font-size:13px;font-weight:700;color:${(expensesDelta ?? 0) <= 0 ? '#16a34a' : '#dc2626'};">
                ${expensesDelta !== null ? fmtPct(expensesDelta) : "—"}
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>` : ""}

    <!-- POR CONTA -->
    ${p.accounts.length > 0 ? `
    <tr>
      <td style="background:#ffffff;padding:8px 28px 20px;">
        <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">&#x1F3E6; Movimentação por conta</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Receita, despesa e saldo líquido em cada conta esta semana</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;font-size:10px;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;" colspan="2">Conta</th>
            <th style="padding:8px 8px;font-size:10px;font-weight:700;color:#64748b;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Entrou</th>
            <th style="padding:8px 8px;font-size:10px;font-weight:700;color:#64748b;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Saiu</th>
            <th style="padding:8px 12px;font-size:10px;font-weight:700;color:#64748b;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Saldo</th>
          </tr>
          ${accountRows}
        </table>
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

// -- Envio via Brevo --
const BREVO_SENDER_NAME  = Deno.env.get("BREVO_SENDER_NAME")  || "FinancasPro";
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "amaralstradiotoryan@gmail.com";
async function sendEmailBrevo(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  const raw = await res.text();
  let body: unknown = raw;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  return { ok: res.ok, status: res.status, body };
}

// -- Relatorio semanal focado por conta --
function buildAccountWeeklyHtml(p: {
  firstName: string; weekLabel: string; accountName: string; accountIcon: string;
  income: number; expenses: number; net: number; avgDaily: number;
  categories: CatItem[]; topExpenses: TxItem[]; nextScheduledSend: string;
}): string {
  const netPos = p.net >= 0;
  const accent = "#14b8a6";
  const catRows = p.categories.slice(0, 6).map((c) => {
    const pct = p.expenses > 0 ? Math.round((c.value / p.expenses) * 100) : 0;
    return `<tr><td style="padding:7px 0;font-size:13px;width:1%;white-space:nowrap;">${c.icon}&nbsp;</td>
      <td style="padding:7px 8px 7px 2px;font-size:13px;color:#111827;font-weight:600;">${c.name}</td>
      <td style="padding:7px 0;width:38%;"><div style="height:6px;background:#eef2f7;border-radius:999px;overflow:hidden;"><div style="height:6px;width:${Math.min(pct,100)}%;background:${accent};border-radius:999px;"></div></div></td>
      <td style="padding:7px 0 7px 12px;text-align:right;white-space:nowrap;"><div style="font-size:13px;color:#111827;font-weight:700;">${fmt(c.value)}</div><div style="font-size:11px;color:#9ca3af;">${pct}%</div></td></tr>`;
  }).join("");
  const txRows = p.topExpenses.slice(0, 5).map((t, i) => `<tr style="background:${i%2===0?"#f9fafb":"#ffffff"};">
      <td style="padding:8px 12px;font-size:13px;color:#111827;">${t.description || "Sem descricao"}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;">${t.category}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#dc2626;text-align:right;white-space:nowrap;">${fmt(t.amount)}</td></tr>`).join("");
  const greeting = p.firstName ? `Ola, ${p.firstName}!` : "Ola!";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<style>@media screen and (max-width:620px){table[width="600"]{width:100%!important;max-width:100%!important;}td[width="32%"]{display:block!important;width:100%!important;padding:0 0 10px 0!important;}}</style></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:28px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#0b1220 0%,#0f2a3f 55%,#0e4f54 100%);border-radius:16px 16px 0 0;padding:26px 28px 22px;">
    <span style="display:inline-block;background:${accent};color:#04201d;font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;padding:3px 10px;border-radius:20px;">Conta &bull; Resumo Semanal</span>
    <div style="font-size:24px;font-weight:800;color:#fff;margin-top:12px;">${p.accountIcon}&nbsp;${p.accountName}</div>
    <div style="font-size:13px;color:#99f6e4;margin-top:4px;">${greeting} Semana de <b style="color:#ccfbf1;">${p.weekLabel}</b>.</div>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,${accent},#22d3ee,#0ea5e9);"></td></tr>
  <tr><td style="background:#fff;padding:22px 28px 12px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="32%" style="padding-right:8px;"><div style="border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;padding:13px 15px;"><div style="font-size:10px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Entrou</div><div style="font-size:20px;color:#166534;font-weight:800;margin-top:5px;">${fmt(p.income)}</div></div></td>
    <td width="32%" style="padding:0 4px;"><div style="border-radius:12px;background:#fef2f2;border:1px solid #fecaca;padding:13px 15px;"><div style="font-size:10px;color:#b91c1c;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Saiu</div><div style="font-size:20px;color:#991b1b;font-weight:800;margin-top:5px;">${fmt(p.expenses)}</div></div></td>
    <td width="32%" style="padding-left:8px;"><div style="border-radius:12px;background:${netPos?"#ecfeff":"#fef2f2"};border:1px solid ${netPos?"#a5f3fc":"#fecaca"};padding:13px 15px;"><div style="font-size:10px;color:${netPos?"#0e7490":"#b91c1c"};font-weight:700;text-transform:uppercase;letter-spacing:1px;">Saldo da semana</div><div style="font-size:20px;color:${netPos?"#0f172a":"#991b1b"};font-weight:800;margin-top:5px;">${netPos?"+":""}${fmt(p.net)}</div></div></td>
  </tr></table></td></tr>
  <tr><td style="background:#fff;padding:4px 28px 16px;"><div style="border-radius:10px;background:#f8fafc;border:1px solid #eef2f7;padding:12px 16px;font-size:12px;color:#475569;">Media de gasto/dia nesta conta: <b style="color:#0f172a;">${fmt(p.avgDaily)}</b></div></td></tr>
  ${p.topExpenses.length>0?`<tr><td style="background:#fff;padding:0 28px 18px;"><div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px;">Maiores gastos da semana</div><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:10px;overflow:hidden;border:1px solid #f1f5f9;">${txRows}</table></td></tr>`:""}
  ${p.categories.length>0?`<tr><td style="background:#fff;padding:0 28px 22px;"><div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:6px;">Por categoria</div><table width="100%" cellpadding="0" cellspacing="0" border="0">${catRows}</table></td></tr>`:""}
  <tr><td style="background:#fff;border-radius:0 0 16px 16px;padding:18px 28px 26px;border-top:1px solid #f1f5f9;"><div style="font-size:11px;color:#94a3b8;">Resumo semanal da conta <b>${p.accountName}</b>. Proximo envio: ${p.nextScheduledSend}.</div><div style="font-size:11px;color:#cbd5e1;margin-top:4px;">FinancasPro &bull; gestao financeira inteligente</div></td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const brevoApiKey     = Deno.env.get("BREVO_API_KEY");
    const dataUrl          = Deno.env.get("DATA_SUPABASE_URL")          || Deno.env.get("SUPABASE_URL")!;
    const dataAnonKey      = Deno.env.get("DATA_SUPABASE_ANON_KEY")      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dataServiceRole  = Deno.env.get("DATA_SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret       = Deno.env.get("CRON_SECRET");

    if (!brevoApiKey) {
      return new Response(JSON.stringify({
        error: "BREVO_API_KEY nao configurada. Os resumos semanais sao enviados via Brevo; defina esse secret.",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    interface ProfileEntry { user_id: string; email: string; first_name?: string; perAccount?: boolean; accountIds?: string[] | null; }
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
      const { data: prof } = await dc.from("profiles")
        .select("*") // "*" para nao quebrar se a migration de agendamento ainda nao foi aplicada
        .eq("user_id", user.id).maybeSingle();
      profilesToProcess = [{
        user_id: user.id, email: user.email, first_name: prof?.first_name,
        perAccount: prof?.email_per_account_enabled !== false,
        accountIds: Array.isArray(prof?.email_account_ids) ? prof!.email_account_ids.map(String) : null,
      }];
    } else {
      const adminKey = dataServiceRole || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminUrl = dataServiceRole ? dataUrl : Deno.env.get("SUPABASE_URL")!;
      const adminClient = createClient(adminUrl, adminKey);
      const { data: profiles, error } = await adminClient
        .from("profiles")
        .select("*") // "*" para nao quebrar se a migration de agendamento ainda nao foi aplicada
        .eq("weekly_summary_enabled", true);
      if (error) throw error;
      if (!profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ message: "No users with weekly summary enabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Agendamento por usuario: so envia se HOJE (fuso BR) e um dos dias escolhidos e a hora bate.
      const sp = spNowParts(new Date());
      for (const p of profiles) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pAny = p as any;
        const days = (Array.isArray(pAny.email_weekly_days) && pAny.email_weekly_days.length)
          ? pAny.email_weekly_days.map(Number) : [1];
        const hour = Number.isInteger(pAny.email_hour) ? Number(pAny.email_hour) : 9;
        if (!days.includes(sp.weekday)) continue;
        if (sp.hour !== hour) continue;
        const { data: ud } = await adminClient.auth.admin.getUserById(p.user_id);
        if (ud?.user?.email) profilesToProcess.push({
          user_id: p.user_id, email: ud.user.email, first_name: p.first_name,
          perAccount: pAny.email_per_account_enabled !== false,
          accountIds: Array.isArray(pAny.email_account_ids) ? pAny.email_account_ids.map(String) : null,
        });
      }
    }

    /* Date range: last 7 days */
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
    const deliveryFailures: Array<{ email: string; status: number; error: unknown }> = [];
    let sentCount = 0;

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

      const monthContext = getCurrentMonthContext(now);

      // Janela da semana anterior para comparação
      const prevRangeEnd = new Date(rangeStart);
      prevRangeEnd.setUTCDate(prevRangeEnd.getUTCDate() - 1);
      const prevRangeStart = new Date(prevRangeEnd);
      prevRangeStart.setUTCDate(prevRangeStart.getUTCDate() - 6);
      const prevStartDate = prevRangeStart.toISOString().split("T")[0];
      const prevEndDate = prevRangeEnd.toISOString().split("T")[0];

      const [incRes, expRes, catRes, accRes, monthExpRes, prevIncRes, prevExpRes] = await Promise.all([
        dc.from("income").select("id,amount,date,description,account_id,status")
          .eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate).is("deleted_at", null),
        dc.from("expenses").select("id,amount,date,description,category_id,account_id,status,notes")
          .eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate).is("deleted_at", null),
        dc.from("categories").select("id,name,icon,monthly_budget").eq("user_id", profile.user_id),
        dc.from("accounts").select("id,name,icon,archived").eq("user_id", profile.user_id),
        dc.from("expenses").select("id,amount,date,status,notes")
          .eq("user_id", profile.user_id).gte("date", monthContext.startDate).lte("date", monthContext.endDate).is("deleted_at", null),
        dc.from("income").select("id,amount,status")
          .eq("user_id", profile.user_id).gte("date", prevStartDate).lte("date", prevEndDate).is("deleted_at", null),
        dc.from("expenses").select("id,amount,status,notes")
          .eq("user_id", profile.user_id).gte("date", prevStartDate).lte("date", prevEndDate).is("deleted_at", null),
      ]);

      if (incRes.error) throw incRes.error;
      if (expRes.error) throw expRes.error;
      if (monthExpRes.error) throw monthExpRes.error;

      const income     = incRes.data  || [];
      const expenses   = expRes.data  || [];
      const categories = catRes.data  || [];
      const accounts   = (accRes.data || []).filter((a: Record<string, unknown>) => !a.archived);
      const monthExpenses = monthExpRes.data || [];
      const prevIncomeData = prevIncRes.data || [];
      const prevExpensesData = prevExpRes.data || [];
      const reportExpenses = expenses.filter((e: Record<string, unknown>) => isReportExpense(e));
      const reportMonthExpenses = monthExpenses.filter((e: Record<string, unknown>) => isReportExpense(e));
      const reportPrevExpenses = prevExpensesData.filter((e: Record<string, unknown>) => isReportExpense(e));

      const prevWeekIncome = prevIncomeData.filter((i: Record<string, unknown>) => i.status === "concluido").reduce((s: number, i: Record<string, unknown>) => s + Number(i.amount), 0);
      const prevWeekExpenses = reportPrevExpenses.reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalIncome   = income.filter((i: Record<string, unknown>) => i.status === "concluido").reduce((s: number, i: Record<string, unknown>)   => s + Number(i.amount), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalExpenses = reportExpenses.reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);
      const balance       = totalIncome - totalExpenses;
      const avgDaily      = totalExpenses / 7;
      const monthToDateExpenses = reportMonthExpenses.reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);
      const projectionReady = monthContext.elapsedDays >= 10;
      const projectedMonthly = projectionReady && monthContext.elapsedDays > 0
        ? (monthToDateExpenses / monthContext.elapsedDays) * monthContext.daysInMonth
        : monthToDateExpenses;

      /* Category breakdown */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catMap = new Map<string, CatItem>();
      for (const cat of categories) {
        catMap.set(String(cat.id), { name: String(cat.name), icon: String(cat.icon || "tag"), budget: Number(cat.monthly_budget) || 0, value: 0 });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const e of reportExpenses) {
        const c = catMap.get(String(e.category_id));
        if (c) c.value += Number(e.amount);
      }
      const catBreakdown: CatItem[] = Array.from(catMap.values())
        .filter((c) => c.value > 0)
        .sort((a, b) => b.value - a.value);

      /* Top expenses */
      const catNameMap = new Map(categories.map((c: Record<string, unknown>) => [String(c.id), `${c.icon || ""} ${c.name}`]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topExpenses: TxItem[] = [...reportExpenses]
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.amount) - Number(a.amount))
        .slice(0, 5)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: Record<string, unknown>) => ({
          description: String(e.description || ""),
          amount: Number(e.amount),
          category: String(catNameMap.get(String(e.category_id)) || "Sem categoria"),
          date: String(e.date),
        }));

      /* Account breakdown */
      const accountMap = new Map<string, AccountItem>();
      for (const a of accounts) {
        accountMap.set(String(a.id), {
          name: String(a.name),
          icon: String(a.icon || "🏦"),
          income: 0,
          expenses: 0,
          net: 0,
        });
      }
      for (const i of income.filter((row: Record<string, unknown>) => row.status === "concluido")) {
        const acc = accountMap.get(String(i.account_id));
        if (acc) acc.income += Number(i.amount);
      }
      for (const e of reportExpenses) {
        const acc = accountMap.get(String(e.account_id));
        if (acc) acc.expenses += Number(e.amount);
      }
      const accountBreakdown: AccountItem[] = Array.from(accountMap.values())
        .map((a) => ({ ...a, net: a.income - a.expenses }))
        .filter((a) => a.income > 0 || a.expenses > 0)
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

      const insights = generateWeeklyInsights(
        totalIncome,
        totalExpenses,
        balance,
        avgDaily,
        catBreakdown,
        projectedMonthly,
        projectionReady,
        monthToDateExpenses,
      );

      const html = buildWeeklyHtml({
        firstName: profile.first_name || "",
        weekLabel,
        totalIncome,
        totalExpenses,
        balance,
        avgDaily,
        projectedMonthly,
        projectionReady,
        monthToDateExpenses,
        categories: catBreakdown,
        topExpenses,
        accounts: accountBreakdown,
        prevWeekIncome,
        prevWeekExpenses,
        insights,
        incomeCount: income.length,
        expenseCount: expenses.length,
        nextScheduledSend,
      });

      const res = await sendEmailBrevo(brevoApiKey, profile.email, `Resumo Semanal | ${weekLabel}`, html);
      if (!res.ok) {
        deliveryFailures.push({ email: profile.email, status: res.status, error: res.body });
        console.error(`Brevo error for ${profile.email}:`, JSON.stringify(res.body));
      } else {
        sentCount += 1;
      }

      results.push({
        email: profile.email,
        totalIncome,
        totalExpenses,
        balance,
        delivery: res.ok ? "sent_via_brevo" : "failed",
      });

      // -- E-mail semanal individual por conta --
      try {
        if (profile.perAccount !== false) for (const a of accounts) {
          const id = String(a.id);
          if (profile.accountIds && profile.accountIds.length > 0 && !profile.accountIds.includes(id)) continue;
          const accIncRows = income.filter((i: Record<string, unknown>) => String(i.account_id) === id && i.status === "concluido");
          const accExpRows = reportExpenses.filter((e: Record<string, unknown>) => String(e.account_id) === id);
          const accInc = accIncRows.reduce((s: number, i: Record<string, unknown>) => s + Number(i.amount), 0);
          const accExp = accExpRows.reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount), 0);
          if (accInc === 0 && accExp === 0) continue;
          const accCatMap = new Map<string, CatItem>();
          for (const cat of categories) accCatMap.set(String(cat.id), { name: String(cat.name), icon: String(cat.icon || "tag"), budget: Number(cat.monthly_budget) || 0, value: 0 });
          for (const e of accExpRows) { const cc = accCatMap.get(String(e.category_id)); if (cc) cc.value += Number(e.amount); }
          const accCats = Array.from(accCatMap.values()).filter((cc) => cc.value > 0).sort((x, y) => y.value - x.value);
          const accTop: TxItem[] = [...accExpRows].sort((x: Record<string, unknown>, y: Record<string, unknown>) => Number(y.amount) - Number(x.amount)).slice(0, 5)
            .map((e: Record<string, unknown>) => ({ description: String(e.description || ""), amount: Number(e.amount), category: String(catNameMap.get(String(e.category_id)) || "Sem categoria"), date: String(e.date) }));
          const accHtml = buildAccountWeeklyHtml({
            firstName: profile.first_name || "", weekLabel,
            accountName: String(a.name), accountIcon: String(a.icon || "\ud83c\udfe6"),
            income: accInc, expenses: accExp, net: accInc - accExp, avgDaily: accExp / 7,
            categories: accCats, topExpenses: accTop, nextScheduledSend,
          });
          const accSend = await sendEmailBrevo(brevoApiKey, profile.email, `${a.name} - Resumo Semanal | ${weekLabel}`, accHtml);
          if (accSend.ok) sentCount += 1;
          else deliveryFailures.push({ email: profile.email, status: accSend.status, error: accSend.body });
        }
      } catch (accErr) {
        console.error("per-account weekly email error:", accErr);
      }
    }

    const responseStatus = deliveryFailures.length > 0 ? 502 : 200;
    return new Response(JSON.stringify({
      success: deliveryFailures.length === 0,
      provider: "brevo",
      processed: results.length,
      sent: sentCount,
      failed: deliveryFailures.length,
      deliveryFailures,
      results,
    }), {
      status: responseStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in weekly-summary:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

