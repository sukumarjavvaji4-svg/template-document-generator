const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function analyzeDocx(filePath, label) {
  console.log(`\n==================================================`);
  console.log(`ANALYZING ${label}: ${filePath}`);
  console.log(`==================================================`);

  if (!fs.existsSync(filePath)) {
    console.log(`FILE NOT FOUND: ${filePath}`);
    return null;
  }

  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  const docXmlStr = (await zip.file('word/document.xml')?.async('string')) || '';
  const numXmlStr = (await zip.file('word/numbering.xml')?.async('string')) || '';
  const stylesXmlStr = (await zip.file('word/styles.xml')?.async('string')) || '';

  // Parse numbering.xml
  const numMap = new Map(); // numId -> { abstractNumId }
  const absMap = new Map(); // abstractNumId -> { lvlMap: Map(ilvl -> { numFmt, lvlText }) }

  if (numXmlStr) {
    // AbstractNums
    const absRe = /<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
    let am;
    while ((am = absRe.exec(numXmlStr)) !== null) {
      const absId = am[1];
      const absContent = am[2];
      const lvlMap = new Map();

      const lvlRe = /<w:lvl\b[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g;
      let lm;
      while ((lm = lvlRe.exec(absContent)) !== null) {
        const ilvl = lm[1];
        const lvlContent = lm[2];

        const fmtMatch = lvlContent.match(/<w:numFmt\b[^>]*w:val="([^"]*)"/);
        const txtMatch = lvlContent.match(/<w:lvlText\b[^>]*w:val="([^"]*)"/);

        const numFmt = fmtMatch ? fmtMatch[1] : 'none';
        const lvlText = txtMatch ? txtMatch[1] : '';

        lvlMap.set(ilvl, { numFmt, lvlText });
      }

      absMap.set(absId, { lvlMap });
    }

    // Nums
    const numRe = /<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g;
    let nm;
    while ((nm = numRe.exec(numXmlStr)) !== null) {
      const numId = nm[1];
      const numContent = nm[2];
      const absRefMatch = numContent.match(/<w:abstractNumId\b[^>]*w:val="(\d+)"/);
      const abstractNumId = absRefMatch ? absRefMatch[1] : null;

      numMap.set(numId, { abstractNumId });
    }
  }

  // Parse styles.xml
  const styleNumMap = new Map(); // styleId -> { numId, ilvl }
  if (stylesXmlStr) {
    const styleRe = /<w:style\b[^>]*w:styleId="([^"]*)"[^>]*>([\s\S]*?)<\/w:style>/g;
    let sm;
    while ((sm = styleRe.exec(stylesXmlStr)) !== null) {
      const styleId = sm[1];
      const styleContent = sm[2];
      const numPrMatch = styleContent.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
      if (numPrMatch) {
        const numIdMatch = numPrMatch[1].match(/<w:numId\b[^>]*w:val="(\d+)"/);
        const ilvlMatch = numPrMatch[1].match(/<w:ilvl\b[^>]*w:val="(\d+)"/);
        const numId = numIdMatch ? numIdMatch[1] : null;
        const ilvl = ilvlMatch ? ilvlMatch[1] : '0';
        styleNumMap.set(styleId, { numId, ilvl });
      }
    }
  }

  // Parse document.xml paragraphs
  if (docXmlStr) {
    const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    let pm;

    const targetHeadings = [
      'Introduction',
      'Purpose',
      'Scope',
      'Definitions',
      'References',
      'Overview',
      'Overall Description',
      'Product Perspective',
      'Product Functions',
    ];

    while ((pm = pRe.exec(docXmlStr)) !== null) {
      const pXml = pm[0];
      const textMatch = pXml.replace(/<[^>]+>/g, '').trim();

      const isTarget = targetHeadings.some(h => textMatch.includes(h));

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

        let abstractNumId = null;
        let numFmt = 'NONE';
        let lvlText = '';

        if (numId && numMap.has(numId)) {
          abstractNumId = numMap.get(numId).abstractNumId;
          if (abstractNumId && absMap.has(abstractNumId)) {
            const lvlMap = absMap.get(abstractNumId).lvlMap;
            const lvlInfo = lvlMap.get(ilvl || '0');
            if (lvlInfo) {
              numFmt = lvlInfo.numFmt;
              lvlText = lvlInfo.lvlText;
            }
          }
        }

        console.log(`\nPARAGRAPH: "${textMatch.substring(0, 60)}"`);
        console.log(`  Style:          ${styleId || 'NONE'}`);
        console.log(`  Explicit numPr: ${numPrMatch ? 'YES' : 'NO'}`);
        console.log(`  numId:          ${numId || 'NONE'}`);
        console.log(`  ilvl:           ${ilvl !== null ? ilvl : 'NONE'}`);
        console.log(`  abstractNumId:  ${abstractNumId || 'NONE'}`);
        console.log(`  numFmt:         ${numFmt}`);
        console.log(`  lvlText:        ${lvlText}`);
      }
    }
  }

  return { numMap, absMap, styleNumMap };
}

async function run() {
  const sourcePath = 'C:\\Users\\sukum\\OneDrive\\Documents\\SKILL_MENTOR_SRS.docx';
  const templatePath = 'C:\\Users\\sukum\\Downloads\\2-sidedTemplate (1).docx';
  const generatedPath = 'C:\\Users\\sukum\\Downloads\\Final.docx';

  await analyzeDocx(sourcePath, 'SOURCE (SKILL_MENTOR_SRS)');
  await analyzeDocx(templatePath, 'TEMPLATE (2-sidedTemplate)');
  await analyzeDocx(generatedPath, 'GENERATED (Final.docx)');
}

run().catch(console.error);
