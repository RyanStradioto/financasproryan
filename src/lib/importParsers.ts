/**
 * File parsers for the Import page (CSV, OFX and Bradesco PDF).
 *
 * Extracted from ImportPage so they can be unit-tested. Two long-standing CSV
 * bugs are fixed here:
 *  1. Split credit/debit formats (Bradesco/Itaú/CEF) classified DEBITS as
 *     income — the classifier received an always-positive amount and the
 *     "positive = income" heuristic won. We now pass a signed amount.
 *  2. Footer rows like ";;Total;0,00;9.332,99;..." slipped through (empty
 *     first column) and imported a phantom expense dated today. Split-format
 *     rows now REQUIRE a valid date in the date column.
 */

import { classifyDescription, type ClassificationRule } from '@/hooks/useClassification';
import type { BradescoStatement } from '@/lib/bradescoStatementParser';

export type RowType = 'income' | 'expense' | 'investment' | 'cc_payment';

export type ParsedRow = {
  date: string;
  description: string;
  amount: number;
  type: RowType;
  categoryId: string;
  investmentId: string;
  creditCardId: string;
  selected: boolean;
  confidence: 'high' | 'medium' | 'low';
  classificationReason: string;
  isDuplicate: boolean;
  source: 'bank' | 'cc';
  fitId?: string; // OFX unique ID for dedup
};

type CategoryLike = Array<{ id: string; name: string }>;

// ── small shared helpers ─────────────────────────────────────────────────────

/**
 * Split a CSV line on a SINGLE delimiter. Splitting on both ',' and ';' at the
 * same time (the old behavior) explodes Brazilian decimals — "56,50" became two
 * columns ("56" | "50") in semicolon CSVs like Bradesco's, corrupting every
 * value and shifting columns. The delimiter is detected from the line itself
 * (or passed in, detected once from the header).
 */
export function splitCsvLine(line: string, delim?: ';' | ','): string[] {
  const d = delim ?? (line.includes(';') ? ';' : ',');
  const cols: string[] = [];
  let cur = '', inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === d && !inQuote) { cols.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

export function parseMoney(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function parseDateStr(raw: string): string {
  const br = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const [, d, m, y] = br;
    return `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) return raw.trim().substring(0, 10);
  return new Date().toISOString().split('T')[0];
}

// ── CC payment detection (used by CSV, OFX and PDF parsers) ──────────────────

const CC_PAYMENT_KEYWORDS = [
  'pagamento de fatura', 'pag fatura', 'fatura cartao', 'fatura cartão',
  'pagto fatura', 'pgto cartao', 'pgto cartão', 'pag cartao', 'pag cartão',
  'pagamento nubank', 'debito automatico cartao',
];

export function detectCCPayment(description: string): boolean {
  const lower = description.toLowerCase();
  return CC_PAYMENT_KEYWORDS.some(kw => lower.includes(kw));
}

// ── OFX ──────────────────────────────────────────────────────────────────────

export type OFXType = 'bank' | 'creditcard';

export function detectOFXType(text: string): OFXType {
  if (/<CREDITCARDMSGSRSV1>/i.test(text) || /<CCSTMTTRNRS>/i.test(text) || /<CCSTMTRS>/i.test(text)) {
    return 'creditcard';
  }
  return 'bank';
}

export function extractCCBillMonth(text: string): string {
  const dtEndMatch = text.match(/<DTEND>(\d{8})/i);
  if (dtEndMatch) {
    const dtStr = dtEndMatch[1];
    const year = parseInt(dtStr.slice(0, 4));
    const month = parseInt(dtStr.slice(4, 6));
    const billDate = new Date(year, month, 1);
    return `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── control rows that must never become transactions ─────────────────────────

const CONTROL_DESCRIPTIONS = /^(cod\.?\s*lanc|saldo\s+anterior|saldo\s+do\s+dia|saldo\s+final|total\b|sub-?total)/i;

// ── CSV parser ───────────────────────────────────────────────────────────────

export function parseCSV(text: string, rules: ClassificationRule[], source: 'bank' | 'cc', categories: CategoryLike = []): ParsedRow[] {
  const allLines = text.split(/\r?\n/);
  if (allLines.length < 2) return [];

  // Normalizer tolerant to encoding mismatches: bank CSVs come in UTF-8 OR
  // latin1/cp1252 — read with the wrong one, "Crédito" becomes "Cr�dito" or
  // "CrÃ©dito" and column detection silently failed. We lowercase, strip
  // accents and drop any leftover non-ascii garbage before matching.
  const norm = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '');

  // Find the real header line — some banks prepend account info rows before the actual header
  let headerIdx = 0;
  for (let i = 0; i < Math.min(allLines.length, 10); i++) {
    const lower = norm(allLines[i]);
    if (
      (lower.includes('data') || lower.includes('date')) &&
      (lower.includes('valor') || /hist.{0,3}rico/.test(lower) || /descri/.test(lower) ||
       /cr.{0,3}dito/.test(lower) || /d.{0,3}bito/.test(lower))
    ) {
      headerIdx = i;
      break;
    }
  }

  const lines = allLines.slice(headerIdx);
  if (lines.length < 2) return [];

  // Detect the delimiter ONCE from the header and use it for every row.
  const delim: ';' | ',' = lines[0].includes(';') ? ';' : ',';
  const headerCols = splitCsvLine(lines[0], delim).map(c => norm(c).replace(/\s+/g, ' ').trim());

  // Detect split credit/debit format (Bradesco, Itaú, CEF, Santander, etc.)
  // Regexes tolerate accents lost to encoding mismatch ("crdito", "cradito").
  const creditIdx = headerCols.findIndex(c => /^cr.{0,3}dito/.test(c) || c === 'cr');
  const debitIdx  = headerCols.findIndex(c => /^d.{0,3}bito/.test(c)  || c === 'db');
  const dateIdx   = headerCols.findIndex(c => c === 'data' || c === 'date' || c === 'dt' || c.startsWith('data'));
  const descIdx   = headerCols.findIndex(c =>
    /hist.{0,3}rico/.test(c) || /descri/.test(c) ||
    c.includes('memo') || /lan.{0,3}amento/.test(c)
  );

  const isSplitFormat = creditIdx !== -1 && debitIdx !== -1;
  const isNubank = headerCols.some(c => c.includes('valor')) &&
    (headerCols.some(c => c.includes('identificador')) || headerCols.some(c => c.includes('título') || c.includes('titulo')));

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = splitCsvLine(line, delim);
    if (cols.length < 2) continue;

    // Stop at footer / summary rows (lines that don't start with a date-like value)
    const firstCol = cols[0].trim();
    if (firstCol && !/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(firstCol) && !/^\d{4}-\d{2}-\d{2}/.test(firstCol)) continue;

    let date: string;
    let rawAmount: string;
    let description: string;
    let isIncomeRow = false;

    if (isSplitFormat) {
      // Bradesco / Itaú / CEF style: Date | Desc | [Docto] | Crédito | Débito | Saldo
      const dIdx = dateIdx >= 0 ? dateIdx : 0;
      const hIdx = descIdx >= 0 ? descIdx : (dIdx === 0 ? 1 : 0);

      // Require a REAL date in the date column — kills "Total"/summary rows that
      // have an empty first column and would otherwise import as phantom expenses.
      const rawDate = (cols[dIdx] ?? '').trim();
      if (!/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(rawDate) && !/^\d{4}-\d{2}-\d{2}/.test(rawDate)) continue;

      date = parseDateStr(rawDate);
      description = (cols[hIdx] ?? '').trim() || 'Transação';
      if (CONTROL_DESCRIPTIONS.test(description)) continue; // COD. LANC. / SALDO / TOTAL markers

      const creditVal = parseMoney(cols[creditIdx] ?? '');
      const debitVal  = parseMoney(cols[debitIdx]  ?? '');

      if (creditVal !== null && creditVal > 0) {
        rawAmount = cols[creditIdx];
        isIncomeRow = true;
      } else if (debitVal !== null && debitVal > 0) {
        rawAmount = cols[debitIdx];
        isIncomeRow = false;
      } else {
        continue;
      }
    } else if (isNubank) {
      date = parseDateStr(cols[0]);
      rawAmount = cols[1];
      description = (cols.length >= 4 ? cols[3] : cols[2]) || 'Transação';
    } else {
      // Generic fallback — only accept values that have a decimal separator (avoids picking up doc/transaction IDs)
      date = new Date().toISOString().split('T')[0];
      rawAmount = '0';
      description = 'Transação importada';
      let gotAmount = false;
      for (const col of cols) {
        if (!col) continue;
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(col) || /^\d{4}-\d{2}-\d{2}/.test(col)) {
          date = parseDateStr(col); continue;
        }
        if (!gotAmount && /[,.]/.test(col) && col.length <= 15) {
          const n = parseMoney(col);
          if (n !== null) { rawAmount = col; gotAmount = true; continue; }
        }
        if (col.length > 3 && isNaN(Number(col.replace(/\./g, '').replace(',', '.')))) description = col;
      }
    }

    const amount = parseMoney(rawAmount);
    if (amount === null || amount === 0) continue;

    // Pass a SIGNED amount to the classifier: debits must be negative, otherwise
    // the "positive value = income" heuristic mislabels every debit as income.
    const signedForClassify = isSplitFormat ? (isIncomeRow ? Math.abs(amount) : -Math.abs(amount)) : amount;
    const result = classifyDescription(description, signedForClassify, rules, categories);

    let rowType: RowType;
    if (source === 'cc') {
      rowType = 'expense';
    } else if (isSplitFormat) {
      if (!isIncomeRow && detectCCPayment(description)) {
        rowType = 'cc_payment';
      } else if (isIncomeRow) {
        rowType = 'income';
      } else {
        // debit: expense unless the classifier says investment
        rowType = result.type === 'investment' ? 'investment' : 'expense';
      }
    } else {
      rowType = result.type as RowType;
    }

    rows.push({
      date, description,
      amount: Math.abs(amount),
      type: rowType,
      categoryId: result.categoryId ?? '',
      investmentId: result.investmentId ?? '',
      creditCardId: '',
      selected: true,
      confidence: result.confidence,
      classificationReason: source === 'cc' ? 'Fatura do cartão' : result.reason,
      isDuplicate: false,
      source,
    });
  }
  return rows;
}

// ── OFX parser ───────────────────────────────────────────────────────────────

const CC_CREDIT_SKIP_KEYWORDS = [
  'pagamento recebido', 'ajuste a crédito',
];

function shouldSkipCCCredit(description: string): boolean {
  const lower = description.toLowerCase();
  return CC_CREDIT_SKIP_KEYWORDS.some(kw => lower.includes(kw));
}

export function parseOFX(text: string, rules: ClassificationRule[], categories: CategoryLike = []): { rows: ParsedRow[]; detectedType: OFXType; billMonth?: string } {
  const detectedType = detectOFXType(text);
  const isCreditCard = detectedType === 'creditcard';
  const source: 'bank' | 'cc' = isCreditCard ? 'cc' : 'bank';
  const billMonth = isCreditCard ? extractCCBillMonth(text) : undefined;

  const rows: ParsedRow[] = [];
  const stmtRx = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = stmtRx.exec(text)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n]+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const dtStr = get('DTPOSTED');
    const date = dtStr.length >= 8
      ? `${dtStr.slice(0, 4)}-${dtStr.slice(4, 6)}-${dtStr.slice(6, 8)}`
      : new Date().toISOString().split('T')[0];
    const rawAmount = parseFloat(get('TRNAMT')) || 0;
    if (rawAmount === 0) continue;
    const description = get('MEMO') || get('NAME') || 'Transação OFX';
    const fitId = get('FITID');
    const trnType = get('TRNTYPE').toUpperCase();

    if (isCreditCard && trnType === 'CREDIT' && shouldSkipCCCredit(description)) {
      continue;
    }

    const amount = Math.abs(rawAmount);
    const isIncome = !isCreditCard && rawAmount > 0;

    const result = classifyDescription(description, rawAmount, rules, categories);

    let rowType: RowType;
    let classReason: string;

    if (isCreditCard) {
      rowType = 'expense';
      classReason = 'Fatura do cartão';
    } else if (detectCCPayment(description)) {
      rowType = 'cc_payment';
      classReason = 'Pagamento de fatura detectado';
    } else {
      rowType = isIncome ? 'income' : result.type as RowType;
      classReason = result.reason;
    }

    rows.push({
      date, description, amount,
      type: rowType,
      categoryId: result.categoryId ?? '',
      investmentId: result.investmentId ?? '',
      creditCardId: '',
      selected: true,
      confidence: isCreditCard ? 'high' : result.confidence,
      classificationReason: classReason,
      isDuplicate: false,
      source,
      fitId,
    });
  }
  return { rows, detectedType, billMonth };
}

// ── Bradesco PDF → ParsedRow ─────────────────────────────────────────────────

export function bradescoStatementToRows(
  statement: BradescoStatement,
  rules: ClassificationRule[],
  categories: CategoryLike = [],
): ParsedRow[] {
  return statement.transactions.map(t => {
    // Classify on history + merchant so both "TITULO DE CAPITALIZACAO" and
    // "SUPERM ALIANCA" style keywords can match.
    const combined = `${t.history} ${t.detail}`.trim();
    const signed = t.direction === 'in' ? t.amount : -t.amount;
    const result = classifyDescription(combined, signed, rules, categories);

    let rowType: RowType;
    if (t.direction === 'in') {
      rowType = 'income';
    } else if (detectCCPayment(combined)) {
      rowType = 'cc_payment';
    } else {
      rowType = result.type === 'investment' ? 'investment' : 'expense';
    }

    return {
      date: t.date,
      description: t.detail || t.history,
      amount: t.amount,
      type: rowType,
      categoryId: result.categoryId ?? '',
      investmentId: result.investmentId ?? '',
      creditCardId: '',
      selected: true,
      confidence: result.confidence,
      classificationReason: t.detail ? `${result.reason} · ${t.history}` : result.reason,
      isDuplicate: false,
      source: 'bank' as const,
    };
  });
}

// ── entry point used by the page ─────────────────────────────────────────────

export function parseFile(text: string, fileName: string, rules: ClassificationRule[], forcedSource?: 'bank' | 'cc', categories: CategoryLike = []): { rows: ParsedRow[]; detectedType?: OFXType; billMonth?: string } {
  const ext = fileName.toLowerCase();
  if (ext.endsWith('.ofx') || ext.endsWith('.qfx')) {
    const result = parseOFX(text, rules, categories);
    if (forcedSource && forcedSource !== (result.detectedType === 'creditcard' ? 'cc' : 'bank')) {
      return { rows: result.rows.map(r => ({ ...r, source: forcedSource })), detectedType: result.detectedType, billMonth: result.billMonth };
    }
    return result;
  }
  return { rows: parseCSV(text, rules, forcedSource || 'bank', categories) };
}
