const fs = require('fs');
const JSZip = require('jszip');

async function inspectNumbering() {
  const filePath = 'C:\\Users\\sukum\\.gemini\\antigravity\\scratch\\document-upload-app\\scratch\\Generated_Test.docx';
  if (!fs.existsSync(filePath)) return;
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const numXml = await zip.file('word/numbering.xml')?.async('string');

  console.log(`==================================================`);
  console.log(`NUMBERING XML IN Generated_Test.docx`);
  console.log(`==================================================`);
  console.log(numXml);
}

inspectNumbering();
