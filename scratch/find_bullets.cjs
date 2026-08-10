const fs = require('fs');
const JSZip = require('jszip');

async function findBulletsAndNumbers(filePath) {
  if (!fs.existsSync(filePath)) return;
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const docXml = await zip.file('word/document.xml')?.async('string');
  const numXml = await zip.file('word/numbering.xml')?.async('string');
  if (!docXml || !numXml) return;

  const numMap = new Map();
  const absMap = new Map();

  // Parse numbering.xml
  const absRe = /<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
  let am;
  while ((am = absRe.exec(numXml)) !== null) {
    const absId = am[1];
    const lvlMap = new Map();
    const lvlRe = /<w:lvl\b[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g;
    let lm;
    while ((lm = lvlRe.exec(am[2])) !== null) {
      const fmtMatch = lm[2].match(/<w:numFmt\b[^>]*w:val="([^"]*)"/);
      const txtMatch = lm[2].match(/<w:lvlText\b[^>]*w:val="([^"]*)"/);
      lvlMap.set(lm[1], { numFmt: fmtMatch ? fmtMatch[1] : 'none', lvlText: txtMatch ? txtMatch[1] : '' });
    }
    absMap.set(absId, lvlMap);
  }

  const numRe = /<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g;
  let nm;
  while ((nm = numRe.exec(numXml)) !== null) {
    const absRefMatch = nm[2].match(/<w:abstractNumId\b[^>]*w:val="(\d+)"/);
    if (absRefMatch) numMap.set(nm[1], absRefMatch[1]);
  }

  console.log(`==================================================`);
  console.log(`PARAGRAPH ANALYSIS FOR GENERATED DOCX`);
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

      const absId = numId ? numMap.get(numId) : null;
      const lvlMap = absId ? absMap.get(absId) : null;
      const lvlInfo = lvlMap ? lvlMap.get(ilvl) : null;

      console.log(`[${++count}] TEXT: "${text.substring(0, 50)}"`);
      console.log(`    numId: ${numId} | abstractNumId: ${absId} | ilvl: ${ilvl} | numFmt: ${lvlInfo?.numFmt} | lvlText: ${lvlInfo?.lvlText}`);
    }
  }
}

findBulletsAndNumbers('C:\\Users\\sukum\\Downloads\\Final.docx');
