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
    tips.push(`🚨 Semana no negativo! Despesas superaram receitas em <strong>${fmt(Math.abs(balance))}</strong>. ${topCat ? `Revise os gastos em ${topCat.icon} ${topCat.name} prioritariamente.` : "Revise seus gastos urgente."}`);
  } else if (savingsRateNum < 10 && totalIncome > 0) {
    const topCat = catBreakdown[0];
    tips.push(`📉 Taxa de poupança baixa: <strong>${savingsRateNum.toFixed(1)}%</strong> (meta: 20%). ${topCat ? `Tente reduzir gastos em ${topCat.icon} ${topCat.name} na próxima semana.` : "Identifique quais categorias podem ser reduzidas."}`);
  } else if (savingsRateNum < 20 && totalIncome > 0) {
    const needed = totalIncome * 0.2 - balance;
    tips.push(`📊 Poupança de <strong>${savingsRateNum.toFixed(1)}%</strong> — quase na meta de 20%! Economize mais <strong>${fmt(needed)}</strong> na próxima semana para bater o objetivo.`);
  } else if (savingsRateNum >= 20) {
    tips.push(`🎉 Parabéns! Meta de poupança atingida com <strong>${savingsRateNum.toFixed(1)}%</strong>! Considere investir o excedente de ${fmt(balance)} para acelerar seu patrimônio.`);
  }

  if (catBreakdown.length > 0 && totalExpenses > 0) {
    const top = catBreakdown[0];
    const topPct = Math.round((top.value / totalExpenses) * 100);
    if (topPct > 40) {
      tips.push(`🔍 ${top.icon} <strong>${top.name}</strong> concentrou ${topPct}% dos gastos desta semana (${fmt(top.value)}). Uma única categoria tão dominante pode esconder desperdícios — analise os lançamentos.`);
    }
  }

  const overBudget = catBreakdown.filter((c) => c.budget > 0 && c.value > c.budget);
  if (overBudget.length > 0) {
    const names = overBudget.slice(0, 2).map((c) => {
      const pct = Math.round(((c.value - c.budget) / c.budget) * 100);
      return `${c.icon} ${c.name} (+${pct}%)`;
    }).join(", ");
    tips.push(`🔴 Orçamento estourado: <strong>${names}</strong>. Utilize o controle de orçamento por categoria para evitar surpresas no fim do mês.`);
  }

  if (workDaysForExpenses > 4) {
    tips.push(`⏱️ Você precisou trabalhar <strong>${workDaysForExpenses.toFixed(1)} dias</strong> para cobrir as despesas desta semana. Quanto menos dias de trabalho forem necessários, mais perto você está da liberdade financeira.`);
  } else if (workDaysForExpenses > 0 && workDaysForExpenses <= 2) {
    tips.push(`⚡ Excelente eficiência! Apenas <strong>${workDaysForExpenses.toFixed(1)} dia(s)</strong> de trabalho para cobrir todas as despesas — você está construindo liberdade financeira!`);
  }

  if (tips.length < 3 && catBreakdown.length > 1) {
    const secondCat = catBreakdown[1];
    tips.push(`💰 Monitore de perto ${secondCat.icon} <strong>${secondCat.name}</strong> que representa ${Math.round((secondCat.value / totalExpenses) * 100)}% dos gastos. Pequenas reduções aqui fazem grande diferença no acumulado mensal.`);
  }

  if (tips.length < 2 && totalIncome > 0 && savingsRateNum >= 20) {
    tips.push(`💡 Com esse ritmo de poupança, que tal criar uma reserva de emergência equivalente a 6 meses de despesas?`);
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
  const balBg = balance >= 0 ? "#0d2118" : "#200d0d";
  const balBorder = balance >= 0 ? "#1a4d30" : "#4d1a1a";
  const srClr = savingsRateNum >= 20 ? "#10b981" : savingsRateNum >= 10 ? "#f59e0b" : "#ef4444";

  const srBarPct = Math.min(Math.round((savingsRateNum / 30) * 100), 100);
  const srBarColor = savingsRateNum >= 20 ? "#10b981" : savingsRateNum >= 10 ? "#f59e0b" : "#ef4444";
  const goalMarkerPct = Math.round((20 / 30) * 100);

  const categoryRows = catBreakdown.slice(0, 7).map((cat, index) => {
    const pct = totalExpenses > 0 ? Math.round((cat.value / totalExpenses) * 100) : 0;
    const overBudget = cat.budget > 0 && cat.value > cat.budget;
    const barColors = ["#6366f1", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#14b8a6"];
    const barColor = overBudget ? "#ef4444" : barColors[index % barColors.length];
    const barBgColor = overBudget ? "#3a1010" : "#252538";

    return `
    <tr>
      <td style="padding:0 0 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-bottom:6px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#d1d5db;font-size:13px;font-weight:500;vertical-align:middle;">
                    <span style="font-size:16px;vertical-align:middle;">${cat.icon}</span>&nbsp;<span style="vertical-align:middle;">${cat.name}</span>
                    ${overBudget ? `&nbsp;<span style="color:#ef4444;font-size:10px;font-weight:700;background:#3a1010;padding:1px 5px;border-radius:3px;">ACIMA</span>` : ""}
                  </td>
                  <td align="right" style="font-size:13px;color:#e2e8f0;font-weight:600;white-space:nowrap;vertical-align:middle;">
                    ${fmt(cat.value)}&nbsp;<span style="color:#6b7280;font-weight:400;font-size:11px;">${pct}%</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="${Math.max(pct, 1)}%" bgcolor="${barColor}" style="background:${barColor};height:10px;border-radius:5px 0 0 5px;"></td>
                  <td bgcolor="${barBgColor}" style="background:${barBgColor};height:10px;${pct >= 99 ? "border-radius:0;" : "border-radius:0 5px 5px 0;"}"></td>
                </tr>
              </table>
            </td>
          </tr>
          ${cat.budget > 0 ? `
          <tr>
            <td style="padding-top:3px;">
              <p style="margin:0;font-size:10px;color:#4a4060;">Orçamento: ${fmt(cat.budget)} &nbsp;·&nbsp; ${overBudget ? `<span style="color:#ef4444;">excedido em ${fmt(cat.value - cat.budget)}</span>` : `${fmt(cat.budget - cat.value)} restam`}</p>
            </td>
          </tr>` : ""}
        </table>
      </td>
    </tr>`;
  }).join("");

  const insightColors = [
    { bg: "#0f1f3f", border: "#1e3a6f", accent: "#3b82f6" },
    { bg: "#0d2118", border: "#1a4d30", accent: "#10b981" },
    { bg: "#1e1508", border: "#4d3a10", accent: "#f59e0b" },
    { bg: "#1a0f2e", border: "#2e1a4d", accent: "#8b5cf6" },
  ];
  const insightItems = insights.map((tip, i) => {
    const c = insightColors[i % insightColors.length];
    return `
    <tr>
      <td style="padding-bottom:10px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${c.bg}" style="background:${c.bg};border:1px solid ${c.border};border-left:3px solid ${c.accent};border-radius:2px 8px 8px 2px;padding:13px 16px;">
              <p style="margin:0;font-size:13px;color:#d1d5db;line-height:1.7;">${tip}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join("");

  const hasData = incomeCount > 0 || expenseCount > 0;
  const logoUrl = "https://financasproryan.vercel.app/pwa-192x192.png";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Resumo Semanal — FinançasPro</title>
</head>
<body style="margin:0;padding:0;background:#080810;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080810" style="background:#080810;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

  <tr><td height="5" style="background:linear-gradient(90deg,#6366f1,#8b5cf6 35%,#10b981 70%,#059669);border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- HEADER -->
  <tr><td bgcolor="#0f0f1a" style="background:#0f0f1a;padding:28px 32px 24px;border-left:1px solid #1e1e3a;border-right:1px solid #1e1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="56" valign="middle" style="padding-right:16px;">
          <img src="${logoUrl}" width="48" height="48" alt="" style="border-radius:12px;display:block;" />
        </td>
        <td valign="middle">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">FinançasPro</p>
          <p style="margin:3px 0 0;font-size:12px;color:#6b6b8a;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Resumo Semanal · Gestão Inteligente</p>
        </td>
        <td align="right" valign="middle">
          <table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#1a1a2e" style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:20px;padding:7px 16px;text-align:center;">
            <p style="margin:0;font-size:10px;color:#6b6b8a;text-transform:uppercase;letter-spacing:0.5px;">📅 Semana</p>
            <p style="margin:3px 0 0;font-size:11px;color:#a5b4fc;font-weight:700;">${weekLabel}</p>
          </td></tr></table>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td bgcolor="#0f0f1a" style="padding:0 32px;border-left:1px solid #1e1e3a;border-right:1px solid #1e1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#1e1e3a" style="font-size:0;line-height:0;">&nbsp;</td></tr></table>
  </td></tr>

  <!-- METRICS 2x2 -->
  <tr><td bgcolor="#0f0f1a" style="background:#0f0f1a;padding:24px 32px 0;border-left:1px solid #1e1e3a;border-right:1px solid #1e1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="48%" style="padding:0 8px 12px 0;" valign="top">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#0d2118" style="background:#0d2118;border:1px solid #1a4d30;border-radius:14px;padding:18px;">
              <p style="margin:0;font-size:11px;color:#34d399;text-transform:uppercase;letter-spacing:1px;font-weight:700;">↑ Receitas</p>
              <p style="margin:10px 0 4px;font-size:26px;font-weight:800;color:#10b981;letter-spacing:-0.5px;">${fmtShort(totalIncome)}</p>
              <p style="margin:0;font-size:11px;color:#3a6a4a;">${incomeCount} lançamento${incomeCount !== 1 ? "s" : ""} &nbsp;💰</p>
            </td></tr>
          </table>
        </td>
        <td width="48%" style="padding:0 0 12px 8px;" valign="top">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#200d0d" style="background:#200d0d;border:1px solid #4d1a1a;border-radius:14px;padding:18px;">
              <p style="margin:0;font-size:11px;color:#f87171;text-transform:uppercase;letter-spacing:1px;font-weight:700;">↓ Despesas</p>
              <p style="margin:10px 0 4px;font-size:26px;font-weight:800;color:#ef4444;letter-spacing:-0.5px;">${fmtShort(totalExpenses)}</p>
              <p style="margin:0;font-size:11px;color:#6a3a3a;">${expenseCount} lançamento${expenseCount !== 1 ? "s" : ""} &nbsp;📉</p>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td width="48%" style="padding:0 8px 20px 0;" valign="top">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="${balBg}" style="background:${balBg};border:1px solid ${balBorder};border-radius:14px;padding:18px;">
              <p style="margin:0;font-size:11px;color:${balClr};text-transform:uppercase;letter-spacing:1px;font-weight:700;">${balance >= 0 ? "✓ Saldo" : "✗ Saldo"}</p>
              <p style="margin:10px 0 4px;font-size:26px;font-weight:800;color:${balClr};letter-spacing:-0.5px;">${fmtShort(balance)}</p>
              <p style="margin:0;font-size:11px;color:${balance >= 0 ? "#3a6a4a" : "#6a3a3a"};">${balance >= 0 ? "resultado positivo ✓" : "atenção: revise gastos ⚠️"}</p>
            </td></tr>
          </table>
        </td>
        <td width="48%" style="padding:0 0 20px 8px;" valign="top">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#0f0f20" style="background:#0f0f20;border:1px solid #2a2a4a;border-radius:14px;padding:18px;">
              <p style="margin:0;font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:1px;font-weight:700;">🎯 Poupança</p>
              <p style="margin:10px 0 4px;font-size:26px;font-weight:800;color:${srClr};letter-spacing:-0.5px;">${savingsRateNum.toFixed(1)}%</p>
              <p style="margin:0;font-size:11px;color:#4a4a70;">meta: 20% &nbsp;${savingsRateNum >= 20 ? "🏆" : savingsRateNum >= 10 ? "📊" : "📉"}</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- SAVINGS PROGRESS BAR -->
  ${totalIncome > 0 ? `
  <tr><td bgcolor="#0f0f1a" style="background:#0f0f1a;padding:0 32px 20px;border-left:1px solid #1e1e3a;border-right:1px solid #1e1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="#141428" style="background:#141428;border:1px solid #252550;border-radius:12px;padding:16px 18px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td><p style="margin:0 0 12px;font-size:13px;color:#a5b4fc;font-weight:600;">📊 Progresso de Poupança Semanal</p></td>
            <td align="right"><p style="margin:0 0 12px;font-size:14px;color:${srClr};font-weight:700;">${savingsRateNum.toFixed(1)}%</p></td>
          </tr>
          <tr><td colspan="2">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#1e1e38" style="background:#1e1e38;border-radius:8px;height:12px;padding:0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="${srBarPct}%" bgcolor="${srBarColor}" style="background:${srBarColor};height:12px;border-radius:${srBarPct >= 99 ? "8px" : "8px 0 0 8px"};min-width:${srBarPct > 0 ? "4px" : "0"};"></td>
                    <td bgcolor="#1e1e38" style="background:#1e1e38;height:12px;"></td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td colspan="2" style="padding-top:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="${goalMarkerPct}%" align="right" style="padding-right:2px;">
                <p style="margin:0;font-size:10px;color:#6366f1;font-weight:600;">│&nbsp;meta 20%</p>
              </td>
              <td></td>
            </tr></table>
          </td></tr>
          <tr><td colspan="2" style="padding-top:4px;">
            <p style="margin:0;font-size:11px;color:#55557a;">
              ${savingsRateNum >= 20
                ? `🎉 Meta atingida! Você poupou <strong style="color:#10b981;">${fmt(balance)}</strong> essa semana.`
                : `Para atingir 20%, economize mais <strong style="color:#f59e0b;">${fmt(Math.max(0, totalIncome * 0.2 - balance))}</strong>.`
              }
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>` : ""}

  <!-- TRABALHO EQUIVALENTE -->
  ${hourlyRate > 0 && totalExpenses > 0 ? `
  <tr><td bgcolor="#0f0f1a" style="background:#0f0f1a;padding:0 32px 20px;border-left:1px solid #1e1e3a;border-right:1px solid #1e1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="#1a1205" style="background:#1a1205;border:1px solid #3d2e08;border-radius:12px;padding:16px 18px;">
        <p style="margin:0 0 14px;font-size:13px;color:#fbbf24;font-weight:700;">⚡ Seu Tempo = Seu Dinheiro</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="33%" style="padding-right:5px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#251807" style="background:#251807;border:1px solid #4d3408;border-radius:10px;padding:12px;text-align:center;">
                <p style="margin:0;font-size:10px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Valor/hora</p>
                <p style="margin:8px 0 0;font-size:15px;font-weight:700;color:#fbbf24;">${fmt(hourlyRate)}</p>
              </td></tr></table>
            </td>
            <td width="33%" style="padding:0 2px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#251807" style="background:#251807;border:1px solid #4d3408;border-radius:10px;padding:12px;text-align:center;">
                <p style="margin:0;font-size:10px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Horas gastas</p>
                <p style="margin:8px 0 0;font-size:15px;font-weight:700;color:#fbbf24;">${workHoursForExpenses.toFixed(0)}h</p>
              </td></tr></table>
            </td>
            <td width="33%" style="padding-left:5px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#251807" style="background:#251807;border:1px solid #4d3408;border-radius:10px;padding:12px;text-align:center;">
                <p style="margin:0;font-size:10px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Dias trabalhados</p>
                <p style="margin:8px 0 0;font-size:15px;font-weight:700;color:${workDaysForExpenses > 4 ? "#ef4444" : workDaysForExpenses <= 2 ? "#10b981" : "#fbbf24"};">${workDaysForExpenses.toFixed(1)}d</p>
              </td></tr></table>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>` : ""}

  <!-- CATEGORIAS -->
  ${catBreakdown.length > 0 ? `
  <tr><td bgcolor="#0f0f1a" style="background:#0f0f1a;padding:0 32px 6px;border-left:1px solid #1e1e3a;border-right:1px solid #1e1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td><p style="margin:0;font-size:15px;font-weight:700;color:#e2e8f0;">📊 Gastos por Categoria</p></td>
      <td align="right"><p style="margin:0;font-size:11px;color:#4a4a6a;">${catBreakdown.length} categorias &nbsp;·&nbsp; Total: ${fmt(totalExpenses)}</p></td>
    </tr></table>
  </td></tr>
  <tr><td bgcolor="#0f0f1a" style="background:#0f0f1a;padding:8px 32px 20px;border-left:1px solid #1e1e3a;border-right:1px solid #1e1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${categoryRows}
    </table>
  </td></tr>` : ""}

  <!-- NO DATA -->
  ${!hasData ? `
  <tr><td bgcolor="#0f0f1a" style="background:#0f0f1a;padding:40px 32px;border-left:1px solid #1e1e3a;border-right:1px solid #1e1e3a;text-align:center;">
    <p style="margin:0;font-size:40px;">📝</p>
    <p style="margin:14px 0 6px;font-size:15px;color:#a5b4fc;font-weight:600;">Nenhuma movimentação esta semana</p>
    <p style="margin:0;font-size:13px;color:#4a4a6a;line-height:1.6;">Continue registrando suas transações<br>para receber resumos completos!</p>
  </td></tr>` : ""}

  <!-- INSIGHTS / DICAS -->
  ${insights.length > 0 ? `
  <tr><td bgcolor="#0f0f1a" style="background:#0f0f1a;padding:0 32px 6px;border-left:1px solid #1e1e3a;border-right:1px solid #1e1e3a;">
    <p style="margin:0;font-size:15px;font-weight:700;color:#e2e8f0;">🎯 Dicas para a Próxima Semana</p>
  </td></tr>
  <tr><td bgcolor="#0f0f1a" style="background:#0f0f1a;padding:10px 32px 28px;border-left:1px solid #1e1e3a;border-right:1px solid #1e1e3a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${insightItems}
    </table>
  </td></tr>` : ""}

  <!-- FOOTER -->
  <tr><td bgcolor="#0a0a12" style="background:#0a0a12;padding:20px 32px 28px;border:1px solid #1e1e3a;border-top:1px solid #252545;border-radius:0 0 12px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="36" valign="middle" style="padding-right:12px;">
          <img src="${logoUrl}" width="32" height="32" alt="" style="border-radius:8px;display:block;opacity:0.6;" />
        </td>
        <td valign="middle">
          <p style="margin:0;font-size:12px;color:#454560;font-weight:600;">FinançasPro · Resumo Semanal Automático</p>
          <p style="margin:3px 0 0;font-size:11px;color:#30304a;">Configure notificações em <span style="color:#6366f1;">Configurações → Notificações</span></p>
        </td>
        <td align="right" valign="middle">
          <p style="margin:0;font-size:10px;color:#30304a;">© 2026</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td height="4" style="background:linear-gradient(90deg,#6366f1,#8b5cf6 35%,#10b981 70%,#059669);border-radius:0 0 8px 8px;font-size:0;line-height:0;">&nbsp;</td></tr>

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

    // Data project: old project with real user data
    const dataUrl = Deno.env.get("DATA_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const dataAnonKey = Deno.env.get("DATA_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dataServiceRole = Deno.env.get("DATA_SUPABASE_SERVICE_ROLE_KEY");

    // Check if called with a user JWT (manual invocation from app)
    const authHeader = req.headers.get("Authorization");
    const userJwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    // Distinguish service-role calls (cron) from user calls
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
      // Manual invocation with user JWT — use it to query the data project
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
      // Cron/automated — need service role key for data project
      if (!dataServiceRole) {
        // Fallback: try with local project service role
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

    // Date range: last 7 days
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startDate = weekAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];
    const d1 = startDate.split("-").reverse();
    const d2 = endDate.split("-").reverse();
    const weekLabel = `${d1[0]}/${d1[1]} a ${d2[0]}/${d2[1]}`;

    const results = [];

    for (const profile of profilesToProcess) {
      const email = profile.email;
      if (!email) continue;

      // Build data client for this user's data
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
        dataClient.from("income").select("id,amount,date,description,category_id").eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate),
        dataClient.from("expenses").select("id,amount,date,description,category_id,status").eq("user_id", profile.user_id).gte("date", startDate).lte("date", endDate),
        dataClient.from("categories").select("id,name,icon,color,monthly_budget").eq("user_id", profile.user_id),
      ]);

      const income = incomeResult.data || [];
      const expenses = expensesResult.data || [];
      const categories = categoriesResult.data || [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalIncome = income.reduce((s: number, i: any) => s + Number(i.amount), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
      const balance = totalIncome - totalExpenses;
      const savingsRateNum = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

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

      const monthlySalary = Number(profile.monthly_salary) || 0;
      const workDaysPerWeek = Number(profile.work_days_per_week) || 5;
      const workHoursPerDay = Number(profile.work_hours_per_day) || 8;
      const hourlyRate = monthlySalary > 0 ? monthlySalary / (workDaysPerWeek * 4.33 * workHoursPerDay) : 0;
      const workHoursForExpenses = hourlyRate > 0 ? totalExpenses / hourlyRate : 0;
      const workDaysForExpenses = hourlyRate > 0 ? workHoursForExpenses / workHoursPerDay : 0;

      const insights = generateInsights(totalIncome, totalExpenses, balance, savingsRateNum, catBreakdown, workDaysForExpenses);

      const html = buildWeeklyHtml({
        weekLabel, totalIncome, totalExpenses, balance, savingsRateNum,
        catBreakdown, workDaysForExpenses, workHoursForExpenses, hourlyRate,
        incomeCount: income.length, expenseCount: expenses.length, insights,
      });

      results.push({ email, totalIncome, totalExpenses, balance, savingsRate: savingsRateNum.toFixed(1) });

      if (resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendApiKey}` },
          body: JSON.stringify({
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
