const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');

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

  const docXmlStr = await zip.file('word/document.xml')?.async('string');
  const numXmlStr = await zip.file('word/numbering.xml')?.async('string');
  const stylesXmlStr = await zip.file('word/styles.xml')?.async('string');

  const parser = new DOMParser();

  // Parse numbering.xml
  const numMap = new Map(); // numId -> { abstractNumId }
  const absMap = new Map(); // abstractNumId -> { lvlMap: Map(ilvl -> { numFmt, lvlText }) }

  if (numXmlStr) {
    const numDom = parser.parseFromString(numXmlStr, 'application/xml');

    const abstractNums = Array.from(numDom.getElementsByTagName('w:abstractNum'));
    for (const absNode of abstractNums) {
      const absId = absNode.getAttribute('w:abstractNumId');
      const lvlMap = new Map();

      const lvls = Array.from(absNode.getElementsByTagName('w:lvl'));
      for (const lvlNode of lvls) {
        const ilvl = lvlNode.getAttribute('w:ilvl');
        const numFmtNode = lvlNode.getElementsByTagName('w:numFmt')[0];
        const lvlTextNode = lvlNode.getElementsByTagName('w:lvlText')[0];

        const numFmt = numFmtNode ? numFmtNode.getAttribute('w:val') : 'none';
        const lvlText = lvlTextNode ? lvlTextNode.getAttribute('w:val') : '';

        lvlMap.set(ilvl, { numFmt, lvlText });
      }

      absMap.set(absId, { lvlMap });
    }

    const nums = Array.from(numDom.getElementsByTagName('w:num'));
    for (const numNode of nums) {
      const numId = numNode.getAttribute('w:numId');
      const absRefNode = numNode.getElementsByTagName('w:abstractNumId')[0];
      const abstractNumId = absRefNode ? absRefNode.getAttribute('w:val') : null;

      numMap.set(numId, { abstractNumId });
    }
  }

  // Parse styles.xml
  const styleNumMap = new Map(); // styleId -> { numId, ilvl }
  if (stylesXmlStr) {
    const stylesDom = parser.parseFromString(stylesXmlStr, 'application/xml');
    const styles = Array.from(stylesDom.getElementsByTagName('w:style'));
    for (const styleNode of styles) {
      const styleId = styleNode.getAttribute('w:styleId');
      const numPrNode = styleNode.getElementsByTagName('w:numPr')[0];
      if (numPrNode) {
        const numIdNode = numPrNode.getElementsByTagName('w:numId')[0];
        const ilvlNode = numPrNode.getElementsByTagName('w:ilvl')[0];
        const numId = numIdNode ? numIdNode.getAttribute('w:val') : null;
        const ilvl = ilvlNode ? ilvlNode.getAttribute('w:val') : '0';
        styleNumMap.set(styleId, { numId, ilvl });
      }
    }
  }

  // Parse document.xml paragraphs
  if (docXmlStr) {
    const docDom = parser.parseFromString(docXmlStr, 'application/xml');
    const paragraphs = Array.from(docDom.getElementsByTagName('w:p'));

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

    for (const p of paragraphs) {
      const text = p.textContent.trim();
      const isTarget = targetHeadings.some(h => text.includes(h));

      if (isTarget) {
        const pPrNode = p.getElementsByTagName('w:pPr')[0];
        const pStyleNode = pPrNode ? pPrNode.getElementsByTagName('w:pStyle')[0] : null;
        const styleId = pStyleNode ? pStyleNode.getAttribute('w:val') : null;

        const numPrNode = pPrNode ? pPrNode.getElementsByTagName('w:numPr')[0] : null;
        let numId = null;
        let ilvl = null;

        if (numPrNode) {
          const numIdNode = numPrNode.getElementsByTagName('w:numId')[0];
          const ilvlNode = numPrNode.getElementsByTagName('w:ilvl')[0];
          numId = numIdNode ? numIdNode.getAttribute('w:val') : null;
          ilvl = ilvlNode ? ilvlNode.getAttribute('w:val') : '0';
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

        console.log(`\nPARAGRAPH: "${text.substring(0, 50)}"`);
        console.log(`  Style:          ${styleId || 'NONE'}`);
        console.log(`  Explicit numPr: ${numPrNode ? 'YES' : 'NO'}`);
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
