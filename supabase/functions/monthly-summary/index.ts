import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtShort = (v: number) => {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
  return fmt(v);
};

interface CatItem { name: string; icon: string; value: number; budget: number }

function monthName(year: number, month: number): string {
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(year, month - 1, 1));
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function generateMonthlyInsights(
  totalIncome: number,
  totalExpenses: number,
  balance: number,
  savingsRateNum: number,
  catBreakdown: CatItem[],
  daysInMonth: number,
): string[] {
  const tips: string[] = [];
  const avgDailyExpense = daysInMonth > 0 ? totalExpenses / daysInMonth : 0;

  if (savingsRateNum < 0) {
    tips.push(`🚨 Mês no negativo! Despesas superaram receitas em <strong>${fmt(Math.abs(balance))}</strong>. No próximo mês, estabeleça um orçamento rígido para as principais categorias e revise gastos recorrentes.`);
  } else if (savingsRateNum < 10 && totalIncome > 0) {
    const topCat = catBreakdown[0];
    tips.push(`📉 Taxa de poupança mensal de <strong>${savingsRateNum.toFixed(1)}%</strong> — abaixo da meta de 20%. ${topCat ? `Revise os gastos em ${topCat.icon} ${topCat.name} para o próximo mês.` : "Defina orçamentos por categoria para ter mais controle."}`);
  } else if (savingsRateNum < 20 && totalIncome > 0) {
    const needed = totalIncome * 0.2 - balance;
    tips.push(`📊 Poupança de <strong>${savingsRateNum.toFixed(1)}%</strong> este mês — quase na meta! Economizar mais <strong>${fmt(needed)}</strong> no próximo mês atingiria os 20%.`);
  } else if (savingsRateNum >= 20) {
    tips.push(`🎉 Excelente! Taxa de poupança de <strong>${savingsRateNum.toFixed(1)}%</strong> este mês! Considere investir o excedente de <strong>${fmt(balance)}</strong> para potencializar seu patrimônio.`);
  }

  const overBudget = catBreakdown.filter((c) => c.budget > 0 && c.value > c.budget);
  if (overBudget.length > 0) {
    const names = overBudget.slice(0, 3).map((c) => {
      const pct = Math.round(((c.value - c.budget) / c.budget) * 100);
      return `${c.icon} ${c.name} (+${pct}%)`;
    }).join(", ");
    tips.push(`🔴 Orçamentos estourados: <strong>${names}</strong>. Ajuste os limites ou reduza esses gastos no próximo mês para evitar surpresas.`);
  }

  const nearBudget = catBreakdown.filter((c) => c.budget > 0 && c.value <= c.budget && c.value / c.budget >= 0.85);
  if (nearBudget.length > 0 && overBudget.length === 0) {
    const pct = Math.round((nearBudget[0].value / nearBudget[0].budget) * 100);
    tips.push(`🟡 ${nearBudget[0].icon} <strong>${nearBudget[0].name}</strong> utilizou ${pct}% do orçamento. Fique atento nos próximos meses para não estourar.`);
  }

  if (catBreakdown.length > 0 && totalExpenses > 0) {
    const top = catBreakdown[0];
    const topPct = Math.round((top.value / totalExpenses) * 100);
    if (topPct > 35) {
      tips.push(`🔍 ${top.icon} <strong>${top.name}</strong> foi responsável por ${topPct}% das despesas do mês (${fmt(top.value)}). Uma redução de 20% nessa categoria pouparia <strong>${fmt(top.value * 0.2)}</strong> por mês.`);
    }
  }

  if (avgDailyExpense > 0 && totalIncome > 0) {
    const dailyLimit = totalIncome / daysInMonth;
    if (avgDailyExpense > dailyLimit * 0.9) {
      tips.push(`💡 Sua despesa média diária foi de <strong>${fmt(avgDailyExpense)}</strong>. Para atingir 20% de poupança, o limite diário ideal seria <strong>${fmt(dailyLimit * 0.8)}</strong>.`);
    }
  }

  if (tips.length < 3 && catBreakdown.length > 1) {
    const second = catBreakdown[1];
    tips.push(`💰 ${second.icon} <strong>${second.name}</strong> representou ${Math.round((second.value / totalExpenses) * 100)}% dos gastos mensais. Revise se todos os lançamentos nessa categoria são realmente necessários.`);
  }

  return tips.slice(0, 5);
}

function buildMonthlyHtml(params: {
  monthLabel: string;
  yearLabel: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRateNum: number;
  catBreakdown: CatItem[];
  avgDailyExpense: number;
  daysInMonth: number;
  incomeCount: number;
  expenseCount: number;
  insights: string[];
  investmentTotal: number;
}): string {
  const {
    monthLabel, yearLabel, totalIncome, totalExpenses, balance, savingsRateNum,
    catBreakdown, avgDailyExpense, daysInMonth, incomeCount, expenseCount,
    insights, investmentTotal,
  } = params;

  const balClr = balance >= 0 ? "#10b981" : "#ef4444";
  const balBg = balance >= 0 ? "#0d2118" : "#200d0d";
  const balBorder = balance >= 0 ? "#1a4d30" : "#4d1a1a";
  const srClr = savingsRateNum >= 20 ? "#10b981" : savingsRateNum >= 10 ? "#f59e0b" : "#ef4444";

  const srBarPct = Math.min(Math.round((savingsRateNum / 30) * 100), 100);
  const srBarColor = savingsRateNum >= 20 ? "#10b981" : savingsRateNum >= 10 ? "#f59e0b" : "#ef4444";
  const goalMarkerPct = Math.round((20 / 30) * 100);

  const categoryRows = catBreakdown.slice(0, 8).map((cat, index) => {
    const pct = totalExpenses > 0 ? Math.round((cat.value / totalExpenses) * 100) : 0;
    const overBudget = cat.budget > 0 && cat.value > cat.budget;
    const barColors = ["#8b5cf6", "#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#14b8a6", "#f97316"];
    const barColor = overBudget ? "#ef4444" : barColors[index % barColors.length];
    const barBgColor = overBudget ? "#3a1010" : "#202038";

    const budgetPct = cat.budget > 0 ? Math.min(Math.round((cat.value / cat.budget) * 100), 130) : 0;

    return `
    <tr>
      <td style="padding:0 0 14px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-bottom:6px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#d1d5db;font-size:13px;font-weight:500;vertical-align:middle;">
                    <span style="font-size:16px;vertical-align:middle;">${cat.icon}</span>&nbsp;<span style="vertical-align:middle;">${cat.name}</span>
                    ${overBudget ? `&nbsp;<span style="color:#ef4444;font-size:10px;font-weight:700;background:#3a1010;padding:1px 6px;border-radius:3px;">ACIMA</span>` : ""}
                  </td>
                  <td align="right" style="vertical-align:middle;white-space:nowrap;">
                    <span style="font-size:14px;color:#e2e8f0;font-weight:700;">${fmt(cat.value)}</span>&nbsp;<span style="font-size:11px;color:#6b7280;">${pct}%</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="${Math.max(pct, 1)}%" bgcolor="${barColor}" style="background:${barColor};height:10px;border-radius:5px 0 0 5px;min-width:4px;"></td>
                  <td bgcolor="${barBgColor}" style="background:${barBgColor};height:10px;${pct >= 99 ? "border-radius:0;" : "border-radius:0 5px 5px 0;"}"></td>
                </tr>
              </table>
            </td>
          </tr>
          ${cat.budget > 0 ? `
          <tr>
            <td style="padding-top:4px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:10px;color:#4a4060;">
                    Orçamento: ${fmt(cat.budget)}
                    &nbsp;(${budgetPct}% usado${overBudget ? ` — <span style="color:#ef4444;">+${fmt(cat.value - cat.budget)}</span>` : ` — <span style="color:#10b981;">${fmt(cat.budget - cat.value)} restam</span>`})
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}
        </table>
      </td>
    </tr>`;
  }).join("");

  const insightColors = [
    { bg: "#0f1f3f", border: "#1e3a6f", accent: "#3b82f6" },
    { bg: "#1a0f2e", border: "#2e1a4d", accent: "#8b5cf6" },
    { bg: "#0d2118", border: "#1a4d30", accent: "#10b981" },
    { bg: "#1e1508", border: "#4d3a10", accent: "#f59e0b" },
    { bg: "#200d0d", border: "#4d1a1a", accent: "#ef4444" },
  ];
  const insightItems = insights.map((tip, i) => {
    const c = insightColors[i % insightColors.length];
    return `
    <tr>
      <td style="padding-bottom:10px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${c.bg}" style="background:${c.bg};border:1px solid ${c.border};border-left:3px solid ${c.accent};border-radius:2px 8px 8px 2px;padding:14px 16px;">
              <p style="margin:0;font-size:13px;color:#d1d5db;line-height:1.7;">${tip}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join("");

  const hasData = incomeCount > 0 || expenseCount > 0;
  const logoUrl = "https://financasproryan.vercel.app/pwa-192x192.png";

  // Budget adherence summary
  const catsWithBudget = catBreakdown.filter((c) => c.budget > 0);
  const adherenceRows = catsWithBudget.slice(0, 5).map((cat) => {
    const pct = Math.round((cat.value / cat.budget) * 100);
    const over = cat.value > cat.budget;
    return `
      <tr style="border-bottom:1px solid #1e1e38;">
        <td style="padding:8px 0;font-size:12px;color:#d1d5db;">${cat.icon} ${cat.name}</td>
        <td align="right" style="padding:8px 6px;font-size:12px;color:#e2e8f0;white-space:nowrap;">${fmt(cat.value)}</td>
        <td align="right" style="padding:8px 0 8px 6px;font-size:12px;color:#6b7280;white-space:nowrap;">/ ${fmt(cat.budget)}</td>
        <td align="right" style="padding:8px 0;font-size:11px;color:${over ? "#ef4444" : "#10b981"};white-space:nowrap;font-weight:700;">${pct}%</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Relatório Mensal — FinançasPro</title>
</head>
<body style="margin:0;padding:0;background:#080810;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080810" style="background:#080810;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

  <!-- TOP BAR (purple for monthly, different from weekly green) -->
  <tr><td height="5" style="background:linear-gradient(90deg,#7c3aed,#6d28d9 30%,#8b5cf6 60%,#a78bfa);border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- HEADER -->
  <tr><td bgcolor="#0f0a1a" style="background:#0f0a1a;padding:28px 32px 24px;border-left:1px solid #2a1e3a;border-right:1px solid #2a1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="56" valign="middle" style="padding-right:16px;">
          <img src="${logoUrl}" width="48" height="48" alt="" style="border-radius:12px;display:block;" />
        </td>
        <td valign="middle">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">FinançasPro</p>
          <p style="margin:3px 0 0;font-size:12px;color:#7a6a8a;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Relatório Mensal Completo</p>
        </td>
        <td align="right" valign="middle">
          <table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#1f1530" style="background:#1f1530;border:1px solid #3a2a50;border-radius:20px;padding:8px 16px;text-align:center;">
            <p style="margin:0;font-size:14px;color:#c4b5fd;font-weight:800;">${monthLabel}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#6a5a7a;font-weight:500;">${yearLabel}</p>
          </td></tr></table>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td bgcolor="#0f0a1a" style="padding:0 32px;border-left:1px solid #2a1e3a;border-right:1px solid #2a1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#2a1e3a" style="font-size:0;line-height:0;">&nbsp;</td></tr></table>
  </td></tr>

  <!-- BANNER -->
  <tr><td bgcolor="#12081e" style="background:#12081e;padding:16px 32px;border-left:1px solid #2a1e3a;border-right:1px solid #2a1e3a;">
    <p style="margin:0;font-size:12px;color:#7c5ab8;text-align:center;">📅 Relatório de <strong style="color:#c4b5fd;">${monthLabel} ${yearLabel}</strong> &nbsp;·&nbsp; ${daysInMonth} dias analisados &nbsp;·&nbsp; ${incomeCount + expenseCount} transações no total</p>
  </td></tr>

  <!-- METRICS 2x2 -->
  <tr><td bgcolor="#0f0a1a" style="background:#0f0a1a;padding:20px 32px 0;border-left:1px solid #2a1e3a;border-right:1px solid #2a1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="48%" style="padding:0 8px 12px 0;" valign="top">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#0d2118" style="background:#0d2118;border:1px solid #1a4d30;border-radius:14px;padding:18px;">
              <p style="margin:0;font-size:11px;color:#34d399;text-transform:uppercase;letter-spacing:1px;font-weight:700;">↑ Receitas do Mês</p>
              <p style="margin:10px 0 4px;font-size:28px;font-weight:800;color:#10b981;letter-spacing:-0.5px;">${fmtShort(totalIncome)}</p>
              <p style="margin:0;font-size:11px;color:#3a6a4a;">${incomeCount} receita${incomeCount !== 1 ? "s" : ""} concluída${incomeCount !== 1 ? "s" : ""} &nbsp;💰</p>
            </td></tr>
          </table>
        </td>
        <td width="48%" style="padding:0 0 12px 8px;" valign="top">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#200d0d" style="background:#200d0d;border:1px solid #4d1a1a;border-radius:14px;padding:18px;">
              <p style="margin:0;font-size:11px;color:#f87171;text-transform:uppercase;letter-spacing:1px;font-weight:700;">↓ Despesas do Mês</p>
              <p style="margin:10px 0 4px;font-size:28px;font-weight:800;color:#ef4444;letter-spacing:-0.5px;">${fmtShort(totalExpenses)}</p>
              <p style="margin:0;font-size:11px;color:#6a3a3a;">${expenseCount} despesa${expenseCount !== 1 ? "s" : ""} registrada${expenseCount !== 1 ? "s" : ""} &nbsp;📉</p>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td width="48%" style="padding:0 8px 12px 0;" valign="top">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="${balBg}" style="background:${balBg};border:1px solid ${balBorder};border-radius:14px;padding:18px;">
              <p style="margin:0;font-size:11px;color:${balClr};text-transform:uppercase;letter-spacing:1px;font-weight:700;">${balance >= 0 ? "✓ Saldo Final" : "✗ Saldo Final"}</p>
              <p style="margin:10px 0 4px;font-size:28px;font-weight:800;color:${balClr};letter-spacing:-0.5px;">${fmtShort(balance)}</p>
              <p style="margin:0;font-size:11px;color:${balance >= 0 ? "#3a6a4a" : "#6a3a3a"};">${balance >= 0 ? "mês positivo ✓" : "atenção: mês negativo ⚠️"}</p>
            </td></tr>
          </table>
        </td>
        <td width="48%" style="padding:0 0 12px 8px;" valign="top">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#0f0a1e" style="background:#0f0a1e;border:1px solid #2a1e4a;border-radius:14px;padding:18px;">
              <p style="margin:0;font-size:11px;color:#c4b5fd;text-transform:uppercase;letter-spacing:1px;font-weight:700;">🎯 Taxa de Poupança</p>
              <p style="margin:10px 0 4px;font-size:28px;font-weight:800;color:${srClr};letter-spacing:-0.5px;">${savingsRateNum.toFixed(1)}%</p>
              <p style="margin:0;font-size:11px;color:#4a3a70;">meta: 20% &nbsp;${savingsRateNum >= 20 ? "🏆" : savingsRateNum >= 10 ? "📊" : "📉"}</p>
            </td></tr>
          </table>
        </td>
      </tr>
      ${avgDailyExpense > 0 || investmentTotal > 0 ? `
      <tr>
        ${avgDailyExpense > 0 ? `
        <td width="48%" style="padding:0 8px 20px 0;" valign="top">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#181018" style="background:#181018;border:1px solid #352535;border-radius:14px;padding:18px;">
              <p style="margin:0;font-size:11px;color:#e879f9;text-transform:uppercase;letter-spacing:1px;font-weight:700;">📅 Gasto Médio Diário</p>
              <p style="margin:10px 0 4px;font-size:28px;font-weight:800;color:#f0abfc;letter-spacing:-0.5px;">${fmtShort(avgDailyExpense)}</p>
              <p style="margin:0;font-size:11px;color:#4a2a4a;">por dia em ${monthLabel}</p>
            </td></tr>
          </table>
        </td>` : '<td width="48%" style="padding:0 8px 20px 0;"></td>'}
        ${investmentTotal > 0 ? `
        <td width="48%" style="padding:0 0 20px 8px;" valign="top">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#0a1218" style="background:#0a1218;border:1px solid #1e2e3a;border-radius:14px;padding:18px;">
              <p style="margin:0;font-size:11px;color:#38bdf8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">📈 Investimentos</p>
              <p style="margin:10px 0 4px;font-size:28px;font-weight:800;color:#7dd3fc;letter-spacing:-0.5px;">${fmtShort(investmentTotal)}</p>
              <p style="margin:0;font-size:11px;color:#2a4a5a;">patrimônio acumulado</p>
            </td></tr>
          </table>
        </td>` : '<td width="48%" style="padding:0 0 20px 8px;"></td>'}
      </tr>` : '<tr><td colspan="2" style="padding-bottom:20px;"></td></tr>'}
    </table>
  </td></tr>

  <!-- SAVINGS PROGRESS -->
  ${totalIncome > 0 ? `
  <tr><td bgcolor="#0f0a1a" style="background:#0f0a1a;padding:0 32px 20px;border-left:1px solid #2a1e3a;border-right:1px solid #2a1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="#160e25" style="background:#160e25;border:1px solid #2e1e45;border-radius:12px;padding:18px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td><p style="margin:0 0 14px;font-size:13px;color:#c4b5fd;font-weight:700;">📊 Progresso de Poupança Mensal</p></td>
            <td align="right"><p style="margin:0 0 14px;font-size:14px;color:${srClr};font-weight:700;">${savingsRateNum.toFixed(1)}%<span style="font-size:11px;color:#6a5a7a;font-weight:400;"> / meta 20%</span></p></td>
          </tr>
          <tr><td colspan="2">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#221835" style="background:#221835;border-radius:8px;height:16px;padding:0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="${srBarPct}%" bgcolor="${srBarColor}" style="background:${srBarColor};height:16px;border-radius:${srBarPct >= 99 ? "8px" : "8px 0 0 8px"};min-width:${srBarPct > 0 ? "4px" : "0"};"></td>
                    <td bgcolor="#221835" style="background:#221835;height:16px;"></td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td colspan="2" style="padding-top:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="${goalMarkerPct}%" align="right" style="padding-right:2px;">
                <p style="margin:0;font-size:10px;color:#7c3aed;font-weight:700;">│&nbsp;20%</p>
              </td>
              <td></td>
            </tr></table>
          </td></tr>
          <tr><td colspan="2" style="padding-top:6px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:8px 10px;background:#1a1230;border-radius:8px;">
                  <p style="margin:0;font-size:12px;color:#9a8aaa;line-height:1.6;">
                    ${savingsRateNum >= 20
                      ? `🏆 <strong style="color:#10b981;">Meta atingida!</strong> Você poupou ${fmt(balance)} — considere investir esse valor.`
                      : `Para 20% de poupança, você precisaria ter poupado <strong style="color:#f59e0b;">${fmt(Math.max(0, totalIncome * 0.2))}</strong> (faltaram <strong style="color:#ef4444;">${fmt(Math.max(0, totalIncome * 0.2 - balance))}</strong>).`
                    }
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>` : ""}

  <!-- CATEGORIAS -->
  ${catBreakdown.length > 0 ? `
  <tr><td bgcolor="#0f0a1a" style="background:#0f0a1a;padding:0 32px 6px;border-left:1px solid #2a1e3a;border-right:1px solid #2a1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td><p style="margin:0;font-size:15px;font-weight:700;color:#e2e8f0;">📊 Despesas por Categoria</p></td>
      <td align="right"><p style="margin:0;font-size:11px;color:#4a3a6a;">${catBreakdown.length} categorias &nbsp;·&nbsp; Total: ${fmt(totalExpenses)}</p></td>
    </tr></table>
  </td></tr>
  <tr><td bgcolor="#0f0a1a" style="background:#0f0a1a;padding:10px 32px 20px;border-left:1px solid #2a1e3a;border-right:1px solid #2a1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${categoryRows}
    </table>
  </td></tr>` : ""}

  <!-- BUDGET ADHERENCE TABLE -->
  ${catsWithBudget.length > 0 ? `
  <tr><td bgcolor="#0f0a1a" style="background:#0f0a1a;padding:0 32px 20px;border-left:1px solid #2a1e3a;border-right:1px solid #2a1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="#14102a" style="background:#14102a;border:1px solid #2a205a;border-radius:12px;padding:16px 18px;">
        <p style="margin:0 0 14px;font-size:13px;color:#c4b5fd;font-weight:700;">🎯 Aderência ao Orçamento</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr style="border-bottom:1px solid #2a205a;">
            <td style="padding-bottom:8px;font-size:10px;color:#6a5a8a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Categoria</td>
            <td align="right" style="padding-bottom:8px;font-size:10px;color:#6a5a8a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Gasto</td>
            <td align="right" style="padding-bottom:8px;font-size:10px;color:#6a5a8a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Orçamento</td>
            <td align="right" style="padding-bottom:8px;font-size:10px;color:#6a5a8a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Uso</td>
          </tr>
          ${adherenceRows}
        </table>
      </td></tr>
    </table>
  </td></tr>` : ""}

  <!-- NO DATA -->
  ${!hasData ? `
  <tr><td bgcolor="#0f0a1a" style="background:#0f0a1a;padding:40px 32px;border-left:1px solid #2a1e3a;border-right:1px solid #2a1e3a;text-align:center;">
    <p style="margin:0;font-size:40px;">📅</p>
    <p style="margin:14px 0 6px;font-size:15px;color:#c4b5fd;font-weight:600;">Nenhuma movimentação no mês</p>
    <p style="margin:0;font-size:13px;color:#4a3a6a;line-height:1.6;">Continue registrando suas transações<br>para receber relatórios mensais completos!</p>
  </td></tr>` : ""}

  <!-- INSIGHTS / ANÁLISE -->
  ${insights.length > 0 ? `
  <tr><td bgcolor="#0f0a1a" style="background:#0f0a1a;padding:0 32px 6px;border-left:1px solid #2a1e3a;border-right:1px solid #2a1e3a;">
    <p style="margin:0;font-size:15px;font-weight:700;color:#e2e8f0;">🧠 Análise e Recomendações</p>
  </td></tr>
  <tr><td bgcolor="#0f0a1a" style="background:#0f0a1a;padding:10px 32px 28px;border-left:1px solid #2a1e3a;border-right:1px solid #2a1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${insightItems}
    </table>
  </td></tr>` : ""}

  <!-- FOOTER -->
  <tr><td bgcolor="#0a0812" style="background:#0a0812;padding:20px 32px 28px;border:1px solid #2a1e3a;border-top:1px solid #2e1e45;border-radius:0 0 12px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="36" valign="middle" style="padding-right:12px;">
          <img src="${logoUrl}" width="32" height="32" alt="" style="border-radius:8px;display:block;opacity:0.6;" />
        </td>
        <td valign="middle">
          <p style="margin:0;font-size:12px;color:#3a2a50;font-weight:600;">FinançasPro · Relatório Mensal Automático</p>
          <p style="margin:3px 0 0;font-size:11px;color:#28183a;">Configure notificações em <span style="color:#7c3aed;">Configurações → Notificações</span></p>
        </td>
        <td align="right" valign="middle">
          <p style="margin:0;font-size:10px;color:#28183a;">© 2026</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td height="4" style="background:linear-gradient(90deg,#7c3aed,#6d28d9 30%,#8b5cf6 60%,#a78bfa);border-radius:0 0 8px 8px;font-size:0;line-height:0;">&nbsp;</td></tr>

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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const dataUrl = Deno.env.get("DATA_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const dataAnonKey = Deno.env.get("DATA_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dataServiceRole = Deno.env.get("DATA_SUPABASE_SERVICE_ROLE_KEY");

    const authHeader = req.headers.get("Authorization");
    const userJwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const isServiceRoleCall = userJwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
        const { data: profiles } = await adminClient.from("profiles").select("*").eq("monthly_summary_enabled", true);
        if (!profiles || profiles.length === 0) {
          return new Response(JSON.stringify({ message: "No users with monthly summary enabled" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        for (const p of profiles) {
          const { data: ud } = await adminClient.auth.admin.getUserById(p.user_id);
          if (ud?.user?.email) profilesToProcess.push({ ...p, email: ud.user.email });
        }
      } else {
        const dataAdminClient = createClient(dataUrl, dataServiceRole);
        const { data: profiles, error } = await dataAdminClient.from("profiles").select("*").eq("monthly_summary_enabled", true);
        if (error) throw error;
        if (!profiles || profiles.length === 0) {
          return new Response(JSON.stringify({ message: "No users with monthly summary enabled" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        for (const p of profiles) {
          const { data: ud } = await dataAdminClient.auth.admin.getUserById(p.user_id);
          if (ud?.user?.email) profilesToProcess.push({ ...p, email: ud.user.email });
        }
      }
    }

    // Previous month
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const daysInMonth = new Date(prevYear, prevMonth, 0).getDate();
    const startDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const endDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    const mLabel = monthName(prevYear, prevMonth);

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

      const [incomeResult, expensesResult, categoriesResult, investmentsResult] = await Promise.all([
        dataClient.from("income").select("id,amount,date,description,category_id").eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate),
        dataClient.from("expenses").select("id,amount,date,description,category_id,status").eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate),
        dataClient.from("categories").select("id,name,icon,color,monthly_budget").eq("user_id", profile.user_id),
        dataClient.from("investments").select("current_value").eq("user_id", profile.user_id),
      ]);

      const income = incomeResult.data || [];
      const expenses = expensesResult.data || [];
      const categories = categoriesResult.data || [];
      const investments = investmentsResult.data || [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalIncome = income.reduce((s: number, i: any) => s + Number(i.amount), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
      const balance = totalIncome - totalExpenses;
      const savingsRateNum = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
      const avgDailyExpense = daysInMonth > 0 ? totalExpenses / daysInMonth : 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const investmentTotal = investments.reduce((s: number, i: any) => s + Number(i.current_value || 0), 0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catBreakdown: CatItem[] = categories
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((cat: any) => ({
          name: String(cat.name),
          icon: String(cat.icon || "💰"),
          budget: Number(cat.monthly_budget) || 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: expenses.filter((e: any) => e.category_id === cat.id).reduce((s: number, e: any) => s + Number(e.amount), 0),
        }))
        .filter((c: CatItem) => c.value > 0)
        .sort((a: CatItem, b: CatItem) => b.value - a.value);

      const insights = generateMonthlyInsights(totalIncome, totalExpenses, balance, savingsRateNum, catBreakdown, daysInMonth);

      const html = buildMonthlyHtml({
        monthLabel: mLabel,
        yearLabel: prevYear,
        totalIncome,
        totalExpenses,
        balance,
        savingsRateNum,
        catBreakdown,
        avgDailyExpense,
        daysInMonth,
        incomeCount: income.length,
        expenseCount: expenses.length,
        insights,
        investmentTotal,
      });

      results.push({ email, totalIncome, totalExpenses, balance, savingsRate: savingsRateNum.toFixed(1) });

      if (resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: "FinançasPro <onboarding@resend.dev>",
            to: [email],
            subject: `📅 Relatório Mensal — ${mLabel} ${prevYear}`,
            html,
          }),
        });
        const resData = await res.json();
        if (!res.ok) {
          console.error(`Resend error for ${email}:`, JSON.stringify(resData));
        } else {
          console.log(`Monthly email sent to ${email}: ${resData.id}`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, month: `${mLabel} de ${prevYear}`, processed: results.length, results }), {
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
