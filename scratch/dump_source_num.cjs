const fs = require('fs');
const JSZip = require('jszip');

async function run() {
  const data = fs.readFileSync('C:\\Users\\sukum\\OneDrive\\Documents\\SKILL_MENTOR_SRS.docx');
  const zip = await JSZip.loadAsync(data);
  const numXml = await zip.file('word/numbering.xml')?.async('string');
  console.log(`==================================================`);
  console.log(`SOURCE SKILL_MENTOR_SRS.docx NUMBERING XML`);
  console.log(`==================================================`);
  console.log(numXml || '[NO NUMBERING XML]');
}

run();
