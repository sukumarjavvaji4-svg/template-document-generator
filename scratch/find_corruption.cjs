const fs = require('fs');
const JSZip = require('jszip');

async function checkCorruption(filePath) {
  if (!fs.existsSync(filePath)) { console.log('File not found:', filePath); return; }
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  console.log(`==================================================`);
  console.log(`PARSING ALL XML PARTS IN: ${filePath}`);
  console.log(`==================================================`);

  for (const [relativePath, file] of Object.entries(zip.files)) {
    if (relativePath.endsWith('.xml') || relativePath.endsWith('.rels')) {
      const xmlStr = await file.async('string');
      // Basic tag balance check
      const stack = [];
      const tagRe = /<\/?([a-zA-Z0-9_:-]+)\b[^>]*>/g;
      let match;
      let errCount = 0;

      while ((match = tagRe.exec(xmlStr)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];

        if (fullTag.startsWith('<?') || fullTag.startsWith('<!') || fullTag.endsWith('/>')) {
          continue; // self closing or decl
        }

        if (fullTag.startsWith('</')) {
          const expected = stack.pop();
          if (expected !== tagName) {
            console.log(`[MISMATCH] ${relativePath}: Expected </${expected}> but found </${tagName}> at offset ${match.index}`);
            errCount++;
            if (errCount > 5) break;
          }
        } else {
          stack.push(tagName);
        }
      }

      if (stack.length > 0) {
        console.log(`[UNCLOSED TAGS] ${relativePath}: ${stack.length} tags unclosed (e.g. <${stack[stack.length-1]}>)`);
      } else if (errCount === 0) {
        console.log(`[OK] ${relativePath}`);
      }
    }
  }
}

checkCorruption('C:\\Users\\sukum\\Downloads\\Final.docx');
