/**
 * Nubank Bank Statement (Extrato) PDF Parser
 *
 * Parses Nubank checking-account PDF statements and extracts transactions.
 * Categorizes them automatically:
 *   - Aplicação RDB → investment aporte (expense from checking)
 *   - Resgate RDB → investment resgate (income to checking)
 *   - Pagamento de fatura → CC bill payment ([FATURA_CARTAO])
 *   - Transferência recebida pelo Pix → income
 *   - Transferência enviada pelo Pix → expense
 *   - Compra no débito (via NuPay) → expense
 *   - Débito em conta → expense
 *   - Crédito em conta → income
 *   - Estorno → income
 *
 * The text is extracted via pdfjs-dist, then parsed line-by-line.
 */

import * as pdfjs from 'pdfjs-dist';
// Vite-friendly worker import
// @ts-expect-error - vite handles ?url for workers
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type NubankTxKind =
  | 'aporte_rdb'      // Aplicação RDB
  | 'resgate_rdb'     // Resgate RDB
  | 'cc_bill_payment' // Pagamento de fatura
  | 'pix_in'          // Transferência recebida
  | 'pix_out'         // Transferência enviada
  | 'debit_purchase'  // Compra no débito
  | 'auto_debit'      // Débito em conta
  | 'auto_credit'     // Crédito em conta
  | 'refund'          // Estorno
  | 'unknown';

export interface NubankTransaction {
  date: string;          // YYYY-MM-DD
  amount: number;        // always positive
  direction: 'in' | 'out';
  kind: NubankTxKind;
  description: string;   // raw description (counterparty + label)
  rawType: string;       // original Nubank label
}

export interface NubankStatement {
  periodStart: string;   // YYYY-MM-DD
  periodEnd: string;     // YYYY-MM-DD
  saldoInicial: number;
  saldoFinal: number;
  totalEntradas: number;
  totalSaidas: number;
  transactions: NubankTransaction[];
}

const MONTHS_PT: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};

function parsePtDate(s: string): string | null {
  // Examples: "01 JAN 2026", "07 ABR 2026"
  const m = s.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = MONTHS_PT[m[2]];
  const year = parseInt(m[3], 10);
  if (!mon) return null;
  return `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parse a Brazilian-formatted number, e.g. "1.234,56" or "952,88" → 1234.56 */
function parseBrlNumber(s: string): number {
  return Number(s.replace(/\./g, '').replace(',', '.'));
}

function classifyTransaction(rawType: string, description: string): NubankTxKind {
  const t = rawType.toLowerCase();
  const d = description.toLowerCase();

  if (t.includes('estorno')) return 'refund';
  if (t.includes('aplicação rdb') || t.includes('aplicacao rdb') || d.includes('aplicação rdb')) return 'aporte_rdb';
  if (t.includes('resgate rdb') || d.includes('resgate rdb')) return 'resgate_rdb';
  if (t.includes('pagamento de fatura') || d.includes('pagamento de fatura')) return 'cc_bill_payment';
  if (t.includes('transferência recebida') || t.includes('transferencia recebida')) return 'pix_in';
  if (t.includes('transferência enviada') || t.includes('transferencia enviada')) return 'pix_out';
  if (t.includes('compra no débito') || t.includes('compra no debito')) return 'debit_purchase';
  if (t.includes('débito em conta') || t.includes('debito em conta')) return 'auto_debit';
  if (t.includes('crédito em conta') || t.includes('credito em conta')) return 'auto_credit';
  return 'unknown';
}

/**
 * Extract all text from a PDF using pdfjs-dist.
 * Returns lines (one per visual line in the PDF).
 */
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const allText: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str: string; transform: number[] }>;

    // Group items by their Y coordinate (line)
    const lines: Record<number, Array<{ x: number; str: string }>> = {};
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      (lines[y] ||= []).push({ x, str: item.str });
    }
    // Sort by Y descending (top to bottom in PDF coords) then by X within line
    const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const line = lines[y].sort((a, b) => a.x - b.x).map(p => p.str).join(' ');
      allText.push(line.trim());
    }
  }

  return allText.filter(l => l.length > 0).join('\n');
}

/**
 * Parse a raw Nubank statement text into structured transactions.
 *
 * Strategy: walk lines top-to-bottom, tracking the "current date" (when we
 * see a date heading) and the "current direction" (when we see "Total de
 * entradas" or "Total de saídas"). For each non-summary line that has an
 * amount and a known type prefix, emit a transaction.
 */
export function parseNubankStatementText(rawText: string): NubankStatement {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // Header parsing — saldo inicial / final / período
  let periodStart = '';
  let periodEnd = '';
  let saldoInicial = 0;
  let saldoFinal = 0;
  let totalEntradas = 0;
  let totalSaidas = 0;

  // Match period header e.g. "01 DE JANEIRO DE 2026 a 31 DE JANEIRO DE 2026"
  const MONTH_FULL: Record<string, number> = {
    JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, MARÇO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
    JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
  };
  const fullText = lines.join(' ');
  const periodMatch = fullText.match(/(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})\s+a\s+(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})/i);
  if (periodMatch) {
    const sd = parseInt(periodMatch[1], 10);
    const sm = MONTH_FULL[periodMatch[2].toUpperCase()];
    const sy = parseInt(periodMatch[3], 10);
    const ed = parseInt(periodMatch[4], 10);
    const em = MONTH_FULL[periodMatch[5].toUpperCase()];
    const ey = parseInt(periodMatch[6], 10);
    if (sm && em) {
      periodStart = `${sy}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`;
      periodEnd   = `${ey}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`;
    }
  }

  // Saldo inicial / final / total entradas / total saídas
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const next = lines[i + 1] || '';
    if (/^Saldo inicial$/i.test(l) && /[\d.,]+/.test(next)) {
      saldoInicial = parseBrlNumber(next);
    } else if (/^Total de entradas$/i.test(l) && /^[+]?[\d.,]+/.test(next)) {
      totalEntradas = parseBrlNumber(next.replace(/^\+/, ''));
    } else if (/^Total de saídas$/i.test(l) && /^[-]?[\d.,]+/.test(next)) {
      totalSaidas = parseBrlNumber(next.replace(/^-/, ''));
    } else if (/^Saldo final do período$/i.test(l) && /[\d.,]+/.test(next)) {
      saldoFinal = parseBrlNumber(next);
    }
  }

  // Transaction parsing — walk lines, tracking date + direction
  const transactions: NubankTransaction[] = [];
  let currentDate = '';
  let currentDirection: 'in' | 'out' | null = null;

  // Type prefixes that start a transaction line
  const TX_TYPE_PATTERNS = [
    'Transferência recebida pelo Pix via Open Banking',
    'Transferência recebida pelo Pix',
    'Transferência enviada pelo Pix',
    'Transferência Recebida',
    'Transferência Enviada',
    'Compra no débito via NuPay',
    'Compra no débito',
    'Débito em conta',
    'Crédito em conta',
    'Pagamento de fatura',
    'Aplicação RDB',
    'Resgate RDB',
    'Estorno - Compra no débito via NuPay',
    'Estorno',
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Date heading (e.g. "04 JAN 2026 Total de entradas + 55,00")
    const dateMatch = line.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/);
    if (dateMatch) {
      const d = parsePtDate(line);
      if (d) currentDate = d;
    }

    // Direction toggle
    if (/Total de entradas/i.test(line)) currentDirection = 'in';
    else if (/Total de saídas|Total de saidas/i.test(line)) currentDirection = 'out';

    // Skip summary / header rows (they don't represent individual transactions)
    if (/^Total de (entradas|saídas|saidas)/i.test(line)) continue;
    if (/^Saldo (inicial|final|líquido)/i.test(line)) continue;
    if (/^Movimentações$/i.test(line)) continue;
    if (/Rendimento líquido/i.test(line)) continue;

    // Try to match a transaction type prefix at the start
    let matchedType = '';
    for (const t of TX_TYPE_PATTERNS) {
      if (line.startsWith(t)) {
        matchedType = t;
        break;
      }
    }
    if (!matchedType) continue;

    // The amount is at the end of the line (last numeric token)
    // Numbers like "1.234,56" or "55,00" or "29,10"
    const amounts = line.match(/[\d]{1,3}(?:\.[\d]{3})*,\d{2}/g);
    if (!amounts || amounts.length === 0) continue;
    const amount = parseBrlNumber(amounts[amounts.length - 1]);

    // Description = whatever's between the type and the amount
    const afterType = line.slice(matchedType.length).trim();
    const description = afterType
      .replace(/[\d]{1,3}(?:\.[\d]{3})*,\d{2}\s*$/, '')
      .trim();

    if (!currentDate) continue;
    if (!currentDirection) continue;

    transactions.push({
      date: currentDate,
      amount,
      direction: currentDirection,
      kind: classifyTransaction(matchedType, description),
      description: description || matchedType,
      rawType: matchedType,
    });
  }

  return {
    periodStart,
    periodEnd,
    saldoInicial,
    saldoFinal,
    totalEntradas,
    totalSaidas,
    transactions,
  };
}

/** Convenience: parse a File directly. */
export async function parseNubankPdfFile(file: File): Promise<NubankStatement> {
  const text = await extractPdfText(file);
  return parseNubankStatementText(text);
}

/** Friendly label for each transaction kind */
export const TX_KIND_LABEL: Record<NubankTxKind, string> = {
  aporte_rdb:      'Aplicação RDB → Aporte em investimento',
  resgate_rdb:     'Resgate RDB → Resgate de investimento',
  cc_bill_payment: 'Pagamento de fatura (cartão de crédito)',
  pix_in:          'Pix recebido',
  pix_out:         'Pix enviado',
  debit_purchase:  'Compra no débito',
  auto_debit:      'Débito automático',
  auto_credit:     'Crédito em conta',
  refund:          'Estorno',
  unknown:         'Outro',
};
