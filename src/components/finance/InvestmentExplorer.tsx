import { useMemo, useState } from 'react';
import { ChevronDown, Check, X, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import {
  INVESTMENT_CLASSES, RISK_LABELS, RISK_COLORS, CDI_ANUAL, POUPANCA_MENSAL, type InvestmentClass,
} from '@/lib/investmentEducation';

const CATEGORIES = ['Todos', 'Reserva', 'Renda fixa', 'Renda variável', 'Internacional', 'Cripto'] as const;
const fmt = (v: number) => formatCurrency(v);

function RiskMeter({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="h-1.5 w-3 rounded-full"
          style={{ backgroundColor: n <= level ? RISK_COLORS[level as 1] : 'hsl(var(--muted))' }}
        />
      ))}
    </span>
  );
}

function ClassCard({ item }: { item: InvestmentClass }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 transition-colors hover:border-info/30">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 text-left">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ backgroundColor: item.color + '22' }}
        >
          {item.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold">{item.name}</p>
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{item.category}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.tagline}</p>
        </div>
        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {/* métricas rápidas */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-background/60 px-1 py-1.5">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Risco</p>
          <div className="mt-1 flex justify-center"><RiskMeter level={item.risk} /></div>
          <p className="mt-0.5 text-[10px] font-semibold" style={{ color: RISK_COLORS[item.risk] }}>{RISK_LABELS[item.risk]}</p>
        </div>
        <div className="rounded-lg bg-background/60 px-1 py-1.5">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Liquidez</p>
          <p className="mt-1 text-[11px] font-semibold leading-tight">{item.liquidity}</p>
        </div>
        <div className="rounded-lg bg-background/60 px-1 py-1.5">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Potencial</p>
          <p className="mt-1 text-[11px] font-semibold leading-tight">{item.potential}</p>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2.5 border-t border-border/50 pt-3">
          <div>
            <p className="text-[11px] font-bold text-foreground">👤 Pra quem é</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.forWho}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-income/20 bg-income/[0.05] p-2.5">
              <p className="mb-1 text-[11px] font-bold text-income">Vantagens</p>
              <ul className="space-y-1">
                {item.pros.map((p) => (
                  <li key={p} className="flex items-start gap-1.5 text-[11px] text-foreground/90">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-income" /> {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-expense/20 bg-expense/[0.05] p-2.5">
              <p className="mb-1 text-[11px] font-bold text-expense">Atenção</p>
              <ul className="space-y-1">
                {item.cons.map((c) => (
                  <li key={c} className="flex items-start gap-1.5 text-[11px] text-foreground/90">
                    <X className="mt-0.5 h-3 w-3 shrink-0 text-expense" /> {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvestmentExplorer() {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('Todos');

  // Motivação: R$200/mês por 10 anos a 100% do CDI vs poupança (cálculo inline).
  const demo = useMemo(() => {
    const monthly = 200, n = 120;
    const i = Math.pow(1 + CDI_ANUAL / 100, 1 / 12) - 1;
    let bal = 0, pou = 0;
    for (let m = 0; m < n; m++) {
      bal = bal * (1 + i) + monthly;
      pou = pou * (1 + POUPANCA_MENSAL) + monthly;
    }
    const totalInvested = monthly * n;
    const gain = Math.max(0, bal - totalInvested);
    const net = bal - gain * 0.15; // IR 15% no longo prazo
    return { net, totalInvested, vsPoupanca: net - pou };
  }, []);

  const list = cat === 'Todos' ? INVESTMENT_CLASSES : INVESTMENT_CLASSES.filter((i) => i.category === cat);

  return (
    <div className="space-y-4">
      {/* Banner motivacional */}
      <div className="relative overflow-hidden rounded-2xl border border-info/20 bg-gradient-to-br from-info/10 via-card to-income/[0.06] p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-info/10 blur-3xl" />
        <div className="relative z-10">
          <p className="flex items-center gap-1.5 text-sm font-extrabold">
            <Sparkles className="h-4 w-4 text-info" /> Por que investir vale a pena
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Guardando <span className="font-bold text-foreground">R$ 200/mês</span> por{' '}
            <span className="font-bold text-foreground">10 anos</span> a 100% do CDI, você teria cerca de{' '}
            <span className="font-bold text-income">{fmt(demo.net)}</span> — investindo só{' '}
            <span className="font-semibold text-foreground">{fmt(demo.totalInvested)}</span> do próprio bolso.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-income/25 bg-income/10 px-3 py-1 text-xs font-bold text-income">
              <TrendingUp className="h-3.5 w-3.5" /> +{fmt(demo.vsPoupanca)} vs poupança
            </span>
            <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
              Juros compostos = seu dinheiro rende sobre o que já rendeu
            </span>
          </div>
        </div>
      </div>

      {/* Catálogo de tipos */}
      <div className="stat-card">
        <h3 className="mb-1 text-sm font-bold">Tipos de investimento</h3>
        <p className="mb-3 text-xs text-muted-foreground">Conheça as opções, do mais seguro ao mais ousado. Toque para ver detalhes.</p>

        {/* filtros */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-all',
                cat === c ? 'border-info bg-info/10 text-info' : 'border-border bg-muted/30 text-muted-foreground hover:border-info/40',
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {list.map((item) => <ClassCard key={item.key} item={item} />)}
        </div>
      </div>
    </div>
  );
}
