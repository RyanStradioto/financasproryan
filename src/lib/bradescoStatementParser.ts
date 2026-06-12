/**
 * Bradesco Bank Statement (Extrato) PDF Parser
 *
 * Parses "Bradesco Celular" checking-account PDF statements. Unlike the CSV
 * export (which only carries the generic history, e.g. "COMPRA ELO DEBITO
 * VISTA"), the PDF carries the MERCHANT / counterparty on a detail line —
 * which is what makes automatic classification possible.
 *
 * Layout (reconstructed by text y-position, per page):
 *
 *   COMPRA ELO DEBITO VISTA                      <- history line (text only)
 *   04/05/2026   0010099   56,50   2.483,21      <- data line: [date?] doc value balance
 *   KFC LAGO AZUL 72KM                           <- detail line (merchant)
 *
 * Notes:
 * - The date only appears on the FIRST transaction of each day.
 * - Credit vs debit is NOT distinguishable from the value alone; we derive it
 *   deterministically from the running balance (balance decreased = debit).
 * - "COD. LANC. 0" rows are opening-balance markers (set the running balance).
 * - "Total ..." rows and page headers/footers are skipped.
 * - Pix detail lines look like "DES: FULANO DE TAL 01/05" (strip prefix+date).
 */

export interface BradescoTransaction {
  date: string;            // YYYY-MM-DD
  amount: number;          // always positive
  direction: 'in' | 'out';
  history: string;         // e.g. "COMPRA ELO DEBITO VISTA"
  detail: string;          // e.g. "KFC LAGO AZUL 72KM" (may be '')
  description: string;     // best human description (detail || history)
  doc: string;             // Docto. number
  balanceAfter: number | null;
}

export interface BradescoStatement {
  bank: 'bradesco';
  accountInfo: string;     // "Ag 2388 | Conta 66818-4" (best effort)
  periodStart: string | null;
  periodEnd: string | null;
  transactions: BradescoTransaction[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const BRL_NUM = /\d{1,3}(?:\.\d{3})*,\d{2}/;

function parseBrl(s: string): number {
  return Number(s.replace(/\./g, '').replace(',', '.'));
}

function toIsoDate(br: string): string {
  const [d, m, y] = br.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

const SKIP_LINE = [
  /^bradesco celular/i,
  /^data:\s*\d{2}\/\d{2}\/\d{4}/i,
  /^nome:/i,
  /^extrato de:/i,
  /^folha:/i,
  /^data\s+hist[oó]rico/i,
  /^[uú]ltimos lan[cç]amentos/i,
  /^os dados acima/i,
  /^filtro de resultados/i,
  /^total\b/i,
];

/** Clean a Pix/TED detail line: "DES: FULANO DE TAL 01/05" → "FULANO DE TAL". */
export function cleanBradescoDetail(raw: string): string {
  let s = raw.trim().replace(/\s*\|\s*$/, '').trim();
  s = s.replace(/^DES:\s*/i, '').replace(/^REMET\.\s*/i, '').replace(/^FAV:\s*/i, '');
  // strip trailing dd/mm marker Pix lines carry
  s = s.replace(/\s+\d{2}\/\d{2}$/, '');
  return s.replace(/\s{2,}/g, ' ').trim();
}

export type PdfTextItem = { x: number; y: number; str: string; page: number };

/** Group raw pdf text items into visual lines (per page, top→bottom). */
export function groupItemsIntoLines(items: PdfTextItem[]): string[] {
  const byPage = new Map<number, PdfTextItem[]>();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const arr = byPage.get(it.page) ?? [];
    arr.push(it);
    byPage.set(it.page, arr);
  }
  const lines: string[] = [];
  const pages = [...byPage.keys()].sort((a, b) => a - b);
  for (const p of pages) {
    const rows = new Map<number, PdfTextItem[]>();
    for (const it of byPage.get(p)!) {
      // bucket y with ±2px tolerance
      let key: number | null = null;
      for (const k of rows.keys()) {
        if (Math.abs(k - it.y) <= 2) { key = k; break; }
      }
      const finalKey = key ?? it.y;
      const arr = rows.get(finalKey) ?? [];
      arr.push(it);
      rows.set(finalKey, arr);
    }
    const ys = [...rows.keys()].sort((a, b) => b - a); // pdf y grows upward
    for (const y of ys) {
      const line = rows.get(y)!
        .sort((a, b) => a.x - b.x)
        .map(i => i.str)
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

/**
 * Core parser: works on visual lines (pure, unit-testable).
 */
export function parseBradescoLines(lines: string[]): BradescoStatement {
  const transactions: BradescoTransaction[] = [];
  let accountInfo = '';
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  let currentDate: string | null = null;       // YYYY-MM-DD carried across rows
  let runningBalanceCents: number | null = null;
  let pendingHistory: string | null = null;
  let lastTx: BradescoTransaction | null = null; // waiting for its detail line

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s*\|\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (!line) continue;

    // header metadata
    if (/^extrato de:/i.test(line)) {
      const ag = line.match(/Ag[êe]ncia:\s*([\d-]+)/i)?.[1];
      const cc = line.match(/Conta:\s*([\d-]+)/i)?.[1];
      if (ag || cc) accountInfo = `Ag ${ag ?? '?'} | Conta ${cc ?? '?'}`;
      const period = line.match(/entre:\s*(\d{2}\/\d{2}\/\d{4})\s*e\s*(\d{2}\/\d{2}\/\d{4})/i);
      if (period) { periodStart = toIsoDate(period[1]); periodEnd = toIsoDate(period[2]); }
      // header breaks any pending tx detail (new page)
      lastTx = null;
      continue;
    }
    if (SKIP_LINE.some(rx => rx.test(line))) { lastTx = null; pendingHistory = null; continue; }

    // Opening-balance marker: "30/04/2026 COD. LANC. 0 0,00 2.539,71" or "09/06/2026 COD. LANC. 0 13.324,69"
    if (/COD\.?\s*LANC/i.test(line)) {
      const date = line.match(/^(\d{2}\/\d{2}\/\d{4})/)?.[1];
      if (date) currentDate = toIsoDate(date);
      const nums = line.match(new RegExp(BRL_NUM.source, 'g'));
      if (nums && nums.length > 0) runningBalanceCents = Math.round(parseBrl(nums[nums.length - 1]) * 100);
      pendingHistory = null;
      lastTx = null;
      continue;
    }

    // Data line: [date?] doc value balance  — doc is a plain integer, value+balance are BRL numbers
    const dataMatch = line.match(new RegExp(
      `^(?:(\\d{2}/\\d{2}/\\d{4})\\s+)?(\\d{1,10})\\s+(${BRL_NUM.source})\\s+(${BRL_NUM.source})$`,
    ));
    if (dataMatch) {
      const [, dateBr, doc, valueStr, balanceStr] = dataMatch;
      if (dateBr) currentDate = toIsoDate(dateBr);
      const amount = parseBrl(valueStr);
      const balanceAfterCents = Math.round(parseBrl(balanceStr) * 100);

      if (amount > 0 && currentDate) {
        // Direction from balance movement (deterministic). Fallback: history keywords.
        let direction: 'in' | 'out';
        if (runningBalanceCents !== null && balanceAfterCents !== runningBalanceCents) {
          direction = balanceAfterCents < runningBalanceCents ? 'out' : 'in';
        } else {
          const h = (pendingHistory ?? '').toLowerCase();
          direction = /rendiment|ted c|cr[eé]d|estorno|recebid|sal[aá]rio|dep[oó]sito/.test(h) ? 'in' : 'out';
        }
        const history = (pendingHistory ?? 'Lançamento').trim();
        const tx: BradescoTransaction = {
          date: currentDate,
          amount,
          direction,
          history,
          detail: '',
          description: history,
          doc,
          balanceAfter: balanceAfterCents / 100,
        };
        transactions.push(tx);
        lastTx = tx;
      } else {
        lastTx = null;
      }
      runningBalanceCents = balanceAfterCents;
      pendingHistory = null;
      continue;
    }

    // Plain text line: either the detail of the tx we just closed, or the next history.
    if (lastTx && !lastTx.detail) {
      const detail = cleanBradescoDetail(line);
      if (detail) {
        lastTx.detail = detail;
        lastTx.description = detail;
      }
      lastTx = null;
      continue;
    }
    pendingHistory = line;
  }

  return { bank: 'bradesco', accountInfo, periodStart, periodEnd, transactions };
}

/** Quick sniff: does this look like a Bradesco statement PDF? */
export function looksLikeBradesco(lines: string[]): boolean {
  return lines.some(l => /bradesco/i.test(l)) && lines.some(l => /extrato de:/i.test(l) || /COD\.?\s*LANC/i.test(l));
}

/** Browser entry point: parse a Bradesco statement PDF File. */
export async function parseBradescoPdfFile(file: File): Promise<BradescoStatement> {
  // Lazy-load pdf.js so this heavy lib (and its worker) only loads when a PDF is parsed.
  const pdfjs = await import('pdfjs-dist');
  // @ts-expect-error - vite resolves ?url to the bundled worker asset
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const items: PdfTextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items as Array<{ str: string; transform: number[] }>) {
      items.push({ x: it.transform[4], y: it.transform[5], str: it.str, page: p });
    }
  }
  const lines = groupItemsIntoLines(items);
  if (!looksLikeBradesco(lines)) {
    throw new Error('Este PDF não parece um extrato do Bradesco.');
  }
  const statement = parseBradescoLines(lines);
  if (statement.transactions.length === 0) {
    throw new Error('Nenhuma transação encontrada no PDF do Bradesco.');
  }
  return statement;
}
