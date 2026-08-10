const fs = require('fs');
const JSZip = require('jszip');

async function checkParagraphs() {
  const filePath = 'C:\\Users\\sukum\\.gemini\\antigravity\\scratch\\document-upload-app\\scratch\\Generated_Test.docx';
  if (!fs.existsSync(filePath)) return;
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const docXml = await zip.file('word/document.xml')?.async('string');
  const numXml = await zip.file('word/numbering.xml')?.async('string');
  if (!docXml || !numXml) return;

  const numToAbs = new Map();
  const numRe = /<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g;
  let nm;
  while ((nm = numRe.exec(numXml)) !== null) {
    const absRefMatch = nm[2].match(/<w:abstractNumId\b[^>]*w:val="(\d+)"/);
    if (absRefMatch) numToAbs.set(nm[1], absRefMatch[1]);
  }

  const absFmtMap = new Map();
  const absRe = /<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
  let am;
  while ((am = absRe.exec(numXml)) !== null) {
    const absId = am[1];
    const lvl0Match = am[2].match(/<w:lvl\b[^>]*w:ilvl="0"[^>]*>([\s\S]*?)<\/w:lvl>/i);
    const fmtMatch = lvl0Match ? lvl0Match[1].match(/<w:numFmt\b[^>]*w:val="([^"]*)"/) : null;
    absFmtMap.set(absId, fmtMatch ? fmtMatch[1] : 'none');
  }

  console.log(`==================================================`);
  console.log(`ALL PARAGRAPHS WITH NUMID IN Generated_Test.docx`);
  console.log(`==================================================`);

  const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pm;
  let count = 0;
  while ((pm = pRe.exec(docXml)) !== null) {
    const pXml = pm[0];
    const text = pXml.replace(/<[^>]+>/g, '').trim();
    if (!text) continue;

    const numPrMatch = pXml.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
    if (numPrMatch) {
      const numIdMatch = numPrMatch[1].match(/<w:numId\b[^>]*w:val="(\d+)"/);
      const ilvlMatch = numPrMatch[1].match(/<w:ilvl\b[^>]*w:val="(\d+)"/);
      const numId = numIdMatch ? numIdMatch[1] : null;
      const ilvl = ilvlMatch ? ilvlMatch[1] : '0';

      const absId = numId ? numToAbs.get(numId) : null;
      const fmt = absId ? absFmtMap.get(absId) : 'NONE';

      console.log(`[${++count}] numId: ${numId?.padStart(2, ' ')} | absId: ${absId?.padStart(2, ' ')} | ilvl: ${ilvl} | fmt: ${fmt.padEnd(8, ' ')} | TEXT: "${text.substring(0, 50)}"`);
    }
  }
}

checkParagraphs();
