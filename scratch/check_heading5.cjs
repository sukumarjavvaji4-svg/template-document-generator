const fs = require('fs');
const JSZip = require('jszip');

async function inspectStyle(filePath, label) {
  if (!fs.existsSync(filePath)) return;
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const stylesXml = await zip.file('word/styles.xml')?.async('string');
  console.log(`==================================================`);
  console.log(`HEADING 5 IN ${label}`);
  console.log(`==================================================`);
  if (!stylesXml) { console.log('NO STYLES XML'); return; }

  const match = stylesXml.match(/<w:style\b[^>]*w:styleId="Heading5"[^>]*>([\s\S]*?)<\/w:style>/i);
  if (match) {
    console.log(match[0]);
  } else {
    console.log('Heading5 NOT FOUND IN STYLES');
  }
}

async function run() {
  await inspectStyle('C:\\Users\\sukum\\OneDrive\\Documents\\SKILL_MENTOR_SRS.docx', 'SOURCE');
  await inspectStyle('C:\\Users\\sukum\\Downloads\\2-sidedTemplate (1).docx', 'TEMPLATE');
  await inspectStyle('C:\\Users\\sukum\\Downloads\\Final.docx', 'GENERATED');
}

run();
