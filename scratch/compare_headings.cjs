const fs = require('fs');
const JSZip = require('jszip');

async function analyzeDocx(filePath, label) {
  if (!fs.existsSync(filePath)) return;
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const docXml = await zip.file('word/document.xml')?.async('string');
  const numXml = await zip.file('word/numbering.xml')?.async('string');
  const stylesXml = await zip.file('word/styles.xml')?.async('string');
  if (!docXml || !numXml) return;

  const numMap = new Map();
  const absMap = new Map();

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

  const styleNumMap = new Map();
  if (stylesXml) {
    const styleRe = /<w:style\b[^>]*w:styleId="([^"]*)"[^>]*>([\s\S]*?)<\/w:style>/g;
    let sm;
    while ((sm = styleRe.exec(stylesXml)) !== null) {
      const styleId = sm[1];
      const numPrMatch = sm[2].match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
      if (numPrMatch) {
        const numIdMatch = numPrMatch[1].match(/<w:numId\b[^>]*w:val="(\d+)"/);
        const ilvlMatch = numPrMatch[1].match(/<w:ilvl\b[^>]*w:val="(\d+)"/);
        styleNumMap.set(styleId, { numId: numIdMatch ? numIdMatch[1] : null, ilvl: ilvlMatch ? ilvlMatch[1] : '0' });
      }
    }
  }

  console.log(`\n==================================================`);
  console.log(`TARGET HEADINGS FOR ${label}`);
  console.log(`==================================================`);

  const targetHeadings = [
    'Introduction',
    'Purpose',
    'Scope',
    'Definitions, Acronyms, and Abbreviations',
    'References',
    'Overview',
    'The Overall Description',
    'Product Perspective',
    'Product Functions',
  ];

  const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pm;
  let count = 0;
  while ((pm = pRe.exec(docXml)) !== null) {
    const pXml = pm[0];
    const text = pXml.replace(/<[^>]+>/g, '').trim();

    const isTarget = targetHeadings.some(h => text.includes(h));

    if (isTarget) {
      const pStyleMatch = pXml.match(/<w:pStyle\b[^>]*w:val="([^"]*)"/);
      const styleId = pStyleMatch ? pStyleMatch[1] : null;

      const numPrMatch = pXml.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
      let numId = null;
      let ilvl = null;

      if (numPrMatch) {
        const numIdMatch = numPrMatch[1].match(/<w:numId\b[^>]*w:val="(\d+)"/);
        const ilvlMatch = numPrMatch[1].match(/<w:ilvl\b[^>]*w:val="(\d+)"/);
        numId = numIdMatch ? numIdMatch[1] : null;
        ilvl = ilvlMatch ? ilvlMatch[1] : '0';
      } else if (styleId && styleNumMap.has(styleId)) {
        const sNum = styleNumMap.get(styleId);
        numId = sNum.numId;
        ilvl = sNum.ilvl;
      }

      const absId = numId ? numMap.get(numId) : null;
      const lvlMap = absId ? absMap.get(absId) : null;
      const lvlInfo = lvlMap ? lvlMap.get(ilvl) : null;

      console.log(`[${++count}] TEXT: "${text}"`);
      console.log(`    Style: ${styleId || 'NONE'} | numPr: ${numPrMatch ? 'YES' : 'NO'} | numId: ${numId} | abstractNumId: ${absId} | ilvl: ${ilvl} | numFmt: ${lvlInfo?.numFmt} | lvlText: ${lvlInfo?.lvlText}`);
    }
  }
}

async function run() {
  await analyzeDocx('C:\\Users\\sukum\\OneDrive\\Documents\\SKILL_MENTOR_SRS.docx', 'SOURCE');
  await analyzeDocx('C:\\Users\\sukum\\Downloads\\Final.docx', 'GENERATED');
}

run();
