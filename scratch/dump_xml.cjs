const fs = require('fs');
const JSZip = require('jszip');

async function dump(filePath, label) {
  console.log(`==================================================`);
  console.log(`NUMBERING XML FOR ${label}`);
  console.log(`==================================================`);
  if (!fs.existsSync(filePath)) return;
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const numXml = await zip.file('word/numbering.xml')?.async('string');
  console.log(numXml || '[NO NUMBERING XML]');
}

async function run() {
  await dump('C:\\Users\\sukum\\Downloads\\2-sidedTemplate (1).docx', 'TEMPLATE');
  await dump('C:\\Users\\sukum\\Downloads\\Final.docx', 'GENERATED');
}

run();
