import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { isPdfFile } from '../utils';

// Set up pdf.js worker URL
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
}

/**
 * Validates whether a given Blob starts with PK\x03\x04 (ZIP/DOCX archive signature).
 */
export async function isValidDocxBlob(blob: Blob | null | undefined): Promise<boolean> {
  if (!blob || blob.size < 100) return false;
  try {
    const slice = blob.slice(0, 4);
    const buf = await slice.arrayBuffer();
    const u8 = new Uint8Array(buf);
    return u8[0] === 0x50 && u8[1] === 0x4b; // 'PK'
  } catch {
    return false;
  }
}

/**
 * Converts a PDF File into an editable, template-compatible DOCX File.
 * - Primary Strategy: High-fidelity LibreOffice/Word backend microservice (local or Render).
 * - Client Fallback Strategy: Extracts text paragraphs via pdfjs-dist and packages
 *   them into an OOXML DOCX package using JSZip (100% offline, zero server dependence).
 */
export async function convertPdfToDocx(
  file: File,
  onProgress?: (status: string) => void
): Promise<File> {
  if (!isPdfFile(file)) {
    return file;
  }

  const targetName = file.name.replace(/\.pdf$/i, '') + '.docx';
  onProgress?.('Preparing PDF for template styling...');

  const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // ── Strategy 1: Server-side High-Fidelity Converter ─────────────────────────
  try {
    const endpoint = isLocal
      ? '/api/convert-docx'
      : 'https://template-document-generator.onrender.com/api/convert-docx';

    onProgress?.('Converting PDF with cloud engine...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const docxBlob = await res.blob();
      if (await isValidDocxBlob(docxBlob)) {
        onProgress?.('PDF converted successfully!');
        return new File([docxBlob], targetName, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          lastModified: Date.now(),
        });
      }
    }
  } catch (err) {
    console.warn('Server PDF-to-DOCX conversion unavailable, using in-browser converter:', err);
  }

  // ── Strategy 2: Client-side In-Browser Fallback Converter ────────────────────
  onProgress?.('Extracting document text and layout in browser...');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
    });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const allParagraphs: string[] = [];

    for (let p = 1; p <= totalPages; p++) {
      onProgress?.(`Extracting page ${p} of ${totalPages}...`);
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();

      let currentLine = '';
      let lastY: number | null = null;

      for (const item of textContent.items) {
        if ('str' in item && item.str) {
          const textItem = item as { str: string; transform: number[] };
          const itemY = textItem.transform[5];

          // If vertical jump is significant, start a new paragraph line
          if (lastY !== null && Math.abs(itemY - lastY) > 6) {
            if (currentLine.trim()) {
              allParagraphs.push(currentLine.trim());
            }
            currentLine = textItem.str;
          } else {
            currentLine += (currentLine ? ' ' : '') + textItem.str;
          }
          lastY = itemY;
        }
      }

      if (currentLine.trim()) {
        allParagraphs.push(currentLine.trim());
      }
    }

    onProgress?.('Building Word OpenXML package...');
    const zip = new JSZip();

    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    );

    zip.file(
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );

    let bodyXml = '';
    for (const para of allParagraphs) {
      const escaped = para
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      bodyXml += `<w:p><w:pPr><w:spacing w:after="160" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
    }

    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr/>
  </w:body>
</w:document>`
    );

    const docxBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    onProgress?.('Document extracted and ready!');
    return new File([docxBlob], targetName, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      lastModified: Date.now(),
    });
  } catch (clientErr) {
    console.error('Client-side PDF-to-DOCX conversion failed:', clientErr);
    throw new Error('Could not convert PDF document into Word format. Please ensure the PDF contains readable text.');
  }
}
