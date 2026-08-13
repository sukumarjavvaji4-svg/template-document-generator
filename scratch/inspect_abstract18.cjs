const fs = require('fs');
const JSZip = require('jszip');

async function inspectAbstract(filePath, label) {
  if (!fs.existsSync(filePath)) return;
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const numXml = await zip.file('word/numbering.xml')?.async('string');
  console.log(`==================================================`);
  console.log(`ABSTRACT NUM 18 IN ${label}`);
  console.log(`==================================================`);
  if (!numXml) return;

  const match = numXml.match(/<w:abstractNum\b[^>]*w:abstractNumId="18"[^>]*>([\s\S]*?)<\/w:abstractNum>/i);
  if (match) {
    console.log(match[0]);
  } else {
    console.log('abstractNumId 18 NOT FOUND');
  }
}

async function run() {
  await inspectAbstract('C:\\Users\\sukum\\OneDrive\\Documents\\SKILL_MENTOR_SRS.docx', 'SOURCE');
}

run();
