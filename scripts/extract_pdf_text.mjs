// Temp utility: extract text lines from a PDF using the app's pdfjs-dist.
// Usage: node scripts/extract_pdf_text.mjs <path-to-pdf>
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: node extract_pdf_text.mjs <pdf>'); process.exit(1); }

const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
console.log('PAGES:', doc.numPages);
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  const rows = {};
  for (const it of tc.items) {
    const y = Math.round(it.transform[5]);
    (rows[y] = rows[y] || []).push({ x: it.transform[4], s: it.str });
  }
  const ys = Object.keys(rows).map(Number).sort((a, b) => b - a);
  console.log('=== PAGE ' + p + ' ===');
  for (const y of ys) {
    const line = rows[y].sort((a, b) => a.x - b.x).map(i => i.s).join(' | ');
    if (line.trim()) console.log(line);
  }
}
