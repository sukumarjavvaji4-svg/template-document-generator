const fs = require('fs');
const JSZip = require('jszip');

async function checkRels(filePath, label) {
  if (!fs.existsSync(filePath)) return;
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');
  console.log(`==================================================`);
  console.log(`DOCUMENT.XML.RELS FOR ${label}`);
  console.log(`==================================================`);
  console.log(relsXml || '[NO RELS XML]');
}

async function run() {
  await checkRels('C:\\Users\\sukum\\OneDrive\\Documents\\SKILL_MENTOR_SRS.docx', 'SOURCE');
  await checkRels('C:\\Users\\sukum\\Downloads\\2-sidedTemplate (1).docx', 'TEMPLATE');
  await checkRels('C:\\Users\\sukum\\Downloads\\Final.docx', 'GENERATED');
}

run();
