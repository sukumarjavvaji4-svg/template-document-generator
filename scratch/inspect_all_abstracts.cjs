const fs = require('fs');
const JSZip = require('jszip');

async function inspectAll() {
  const filePath = 'C:\\Users\\sukum\\.gemini\\antigravity\\scratch\\document-upload-app\\scratch\\Generated_Test.docx';
  if (!fs.existsSync(filePath)) return;
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const numXml = await zip.file('word/numbering.xml')?.async('string');
  if (!numXml) return;

  const numRe = /<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g;
  let nm;
  const numToAbs = new Map();
  while ((nm = numRe.exec(numXml)) !== null) {
    const absRefMatch = nm[2].match(/<w:abstractNumId\b[^>]*w:val="(\d+)"/);
    if (absRefMatch) numToAbs.set(nm[1], absRefMatch[1]);
  }

  console.log(`==================================================`);
  console.log(`ALL NUMS AND THEIR ABSTRACT DEFINITIONS IN Generated_Test.docx`);
  console.log(`==================================================`);
  for (const [numId, absId] of numToAbs) {
    const absMatch = numXml.match(new RegExp(`<w:abstractNum\\b[^>]*w:abstractNumId="${absId}"[^>]*>([\\s\\S]*?)<\\/w:abstractNum>`, 'i'));
    if (absMatch) {
      const lvl0Match = absMatch[1].match(/<w:lvl\b[^>]*w:ilvl="0"[^>]*>([\s\S]*?)<\/w:lvl>/i);
      const fmtMatch = lvl0Match ? lvl0Match[1].match(/<w:numFmt\b[^>]*w:val="([^"]*)"/) : null;
      const txtMatch = lvl0Match ? lvl0Match[1].match(/<w:lvlText\b[^>]*w:val="([^"]*)"/) : null;
      console.log(`numId ${numId.padStart(2, ' ')} -> abstractNumId ${absId.padStart(2, ' ')} | ilvl 0: fmt=${fmtMatch?.[1] || 'NONE'} txt="${txtMatch?.[1] || ''}"`);
    } else {
      console.log(`numId ${numId.padStart(2, ' ')} -> abstractNumId ${absId.padStart(2, ' ')} NOT FOUND IN XML!`);
    }
  }
}

inspectAll();
