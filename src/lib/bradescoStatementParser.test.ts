import { describe, it, expect } from 'vitest';
import { parseBradescoLines, cleanBradescoDetail, looksLikeBradesco } from './bradescoStatementParser';
import { parseCSV, bradescoStatementToRows } from './importParsers';

// Synthetic fixture mirroring the real "Bradesco Celular" PDF layout
// (history line → data line with optional date → merchant/detail line).
const PDF_LINES = [
  'Bradesco Celular',
  'Data: 11/06/2026 - 13h13',
  'Nome: FULANO DE TAL',
  'Extrato de: Agência: 1234 | Conta: 99999-9 | Movimentação entre: 01/05/2026 e 31/05/2026 |',
  'Folha: 1/2',
  'Data Histórico Docto. Crédito (R$) Débito (R$) Saldo (R$)',
  '30/04/2026 COD. LANC. 0 0,00 2.539,71',
  'COMPRA ELO DEBITO VISTA',
  '04/05/2026 0010099 56,50 2.483,21',
  'KFC LAGO AZUL 72KM',
  'COMPRA ELO DEBITO VISTA',
  '0032224 28,67 2.454,54',
  'POSTO LAGO AZUL',
  'PIX ENVIADO',
  '1246195 550,00 1.904,54',
  'DES: Maria Souza 01/05',
  'RENDIMENTOS',
  '07/05/2026 0706673 4,56 1.909,10',
  'POUP FACIL-DEPOS A PARTIR 4/5/12',
  'TED C SAL P/ C CORRENTE',
  '7540235 2.017,13 3.926,23',
  'REMET.FULANO DE TAL',
  'TITULO DE CAPITALIZACAO',
  '11/05/2026 1102388 11,39 3.914,84',
  'CAPITALIZACAO 1190 0000000000-0',
  'Total 2.021,69 646,56 3.914,84',
  // page 2 (Últimos Lançamentos)
  'Bradesco Celular',
  'Extrato de: Agência: 1234 | Conta: 99999-9 | Últimos Lancamentos |',
  'Folha: 2/2',
  'Data Histórico Docto. Crédito (R$) Débito (R$) Saldo (R$)',
  '09/06/2026 COD. LANC. 0 13.324,69',
  'PIX ENVIADO',
  '10/06/2026 0715325 9.000,00 4.324,69',
  'DES: EMPRESA XYZ 10/06',
  'Total 0,00 9.000,00 4.324,69',
];

describe('parseBradescoLines', () => {
  const st = parseBradescoLines(PDF_LINES);

  it('detects bank metadata', () => {
    expect(looksLikeBradesco(PDF_LINES)).toBe(true);
    expect(st.accountInfo).toBe('Ag 1234 | Conta 99999-9');
    expect(st.periodStart).toBe('2026-05-01');
    expect(st.periodEnd).toBe('2026-05-31');
  });

  it('extracts every transaction with merchant and skips control rows', () => {
    expect(st.transactions).toHaveLength(7); // 6 May + 1 June ("Últimos Lançamentos")
    expect(st.transactions.some(t => /total|cod\.? lanc/i.test(t.history))).toBe(false);

    const kfc = st.transactions[0];
    expect(kfc).toMatchObject({
      date: '2026-05-04', amount: 56.50, direction: 'out',
      history: 'COMPRA ELO DEBITO VISTA', detail: 'KFC LAGO AZUL 72KM',
    });
  });

  it('carries implicit dates from previous row', () => {
    const posto = st.transactions[1];
    expect(posto.date).toBe('2026-05-04'); // no date on its own data line
    expect(posto.detail).toBe('POSTO LAGO AZUL');
  });

  it('derives direction from the running balance', () => {
    const byHistory = (h: string) => st.transactions.filter(t => t.history.includes(h));
    expect(byHistory('RENDIMENTOS')[0].direction).toBe('in');
    expect(byHistory('TED C SAL')[0].direction).toBe('in');
    expect(byHistory('PIX ENVIADO').every(t => t.direction === 'out')).toBe(true);
    expect(byHistory('CAPITALIZACAO')[0].direction).toBe('out');
  });

  it('cleans Pix/TED detail prefixes and date suffixes', () => {
    const pix = st.transactions.find(t => t.history === 'PIX ENVIADO' && t.date.startsWith('2026-05'))!;
    expect(pix.detail).toBe('Maria Souza');
    const ted = st.transactions.find(t => t.history.includes('TED'))!;
    expect(ted.detail).toBe('FULANO DE TAL');
  });

  it('parses the "Últimos Lançamentos" section with its own balance baseline', () => {
    const bigPix = st.transactions.find(t => t.amount === 9000)!;
    expect(bigPix.date).toBe('2026-06-10');
    expect(bigPix.direction).toBe('out');
    expect(bigPix.detail).toBe('EMPRESA XYZ');
  });

  it('cleanBradescoDetail handles prefixes', () => {
    expect(cleanBradescoDetail('DES: CPFL PIRATININGA 11/05')).toBe('CPFL PIRATININGA');
    expect(cleanBradescoDetail('REMET.JOAO DA SILVA')).toBe('JOAO DA SILVA');
  });
});

describe('bradescoStatementToRows', () => {
  const st = parseBradescoLines(PDF_LINES);
  const rows = bradescoStatementToRows(st, [], [
    { id: 'cat-ali', name: 'Alimentação' },
    { id: 'cat-tra', name: 'Transporte' },
  ]);

  it('maps credits to income and debits to expense/investment', () => {
    const kfc = rows.find(r => r.description.includes('KFC'))!;
    expect(kfc.type).toBe('expense');
    expect(kfc.categoryId).toBe('cat-ali'); // 'kfc' keyword → Alimentação

    const posto = rows.find(r => r.description.includes('POSTO'))!;
    expect(posto.type).toBe('expense');
    expect(posto.categoryId).toBe('cat-tra'); // 'posto' → Transporte

    expect(rows.find(r => r.description.includes('POUP FACIL'))!.type).toBe('income');
    expect(rows.find(r => r.description.includes('FULANO'))!.type).toBe('income');
    // capitalização → investment (patrimonial, never expense)
    expect(rows.find(r => r.description.includes('CAPITALIZACAO'))!.type).toBe('investment');
  });
});

// ── Bradesco CSV (split credit/debit) regression tests ───────────────────────

const BRADESCO_CSV = [
  'Extrato de: Ag: 1234 | Conta: 99999-9;;;;;',
  'Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)',
  '30/04/2026;COD. LANC. 0;0;0,00; ;2.539,71',
  '04/05/2026;COMPRA ELO DEBITO VISTA;10099; ;56,50;2.483,21',
  '07/05/2026;RENDIMENTOS;706673;4,56; ;2.487,77',
  '07/05/2026;TED C SAL P/ C CORRENTE;7540235;2.017,13; ;4.504,90',
  '11/05/2026;TITULO DE CAPITALIZACAO;1102388; ;11,39;4.493,51',
  ';;;;;',
  'Filtro de resultados - Movimentação entre:  01/05/2026 e 31/05/2026;;;;;',
  ';;Total;0,00;67,89;4.493,51;',
].join('\n');

describe('parseCSV — Bradesco split format', () => {
  const rows = parseCSV(BRADESCO_CSV, [], 'bank', []);

  it('classifies debits as expense (not income) and credits as income', () => {
    const compra = rows.find(r => r.description.includes('COMPRA'))!;
    expect(compra.type).toBe('expense');
    expect(compra.amount).toBe(56.50);
    expect(compra.date).toBe('2026-05-04');

    expect(rows.find(r => r.description === 'RENDIMENTOS')!.type).toBe('income');
    expect(rows.find(r => r.description.includes('TED C SAL'))!.type).toBe('income');
    expect(rows.find(r => r.description.includes('CAPITALIZACAO'))!.type).toBe('investment');
  });

  it('never imports COD. LANC. or Total/footer rows', () => {
    expect(rows).toHaveLength(4);
    expect(rows.some(r => /cod\.? lanc|total/i.test(r.description))).toBe(false);
    expect(rows.some(r => r.amount === 67.89)).toBe(false); // the Total row
  });
});
