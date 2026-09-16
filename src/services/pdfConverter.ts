import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { renderAsync } from 'docx-preview';

/**
 * Converts a DOCX Blob to a high-fidelity multi-page A4 PDF Blob entirely in the browser.
 * Uses docx-preview to lay out all OOXML pages, styles, tables, and borders,
 * and jsPDF + html2canvas to assemble crisp A4 PDF pages.
 * 
 * Works 100% offline and on static websites (Vercel, Netlify, GitHub Pages, etc.)
 * with zero server dependencies.
 */
export async function convertDocxToPdfClientSide(
  blob: Blob,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  // 1. Create hidden offscreen render container with exact A4 proportions
  const container = document.createElement('div');
  container.id = 'docx-pdf-render-container';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.background = '#ffffff';
  container.style.zIndex = '-99999';
  container.style.pointerEvents = 'none';
  container.style.opacity = '1';
  document.body.appendChild(container);

  try {
    // 2. Render DOCX using OOXML engine with full page-break preservation
    await renderAsync(blob, container, undefined, {
      className: 'docx-preview-content',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      experimental: true,
      trimXmlDeclaration: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    });

    // Allow brief tick for inline images and layouts to settle
    await new Promise(r => setTimeout(r, 100));

    // 3. Find all rendered document sections
    let sections = Array.from(
      container.querySelectorAll<HTMLElement>('section.docx, .docx-wrapper > section, .docx-preview-content > section, section')
    );

    // If no individual section elements found, fallback to wrapper
    if (sections.length === 0) {
      const wrapper = container.querySelector<HTMLElement>('.docx-wrapper, .docx-preview-content, article');
      if (wrapper) sections = [wrapper];
      else sections = [container];
    }

    // Clean up any outer shadows or margins on individual sections
    sections.forEach(s => {
      s.style.boxShadow = 'none';
      s.style.margin = '0 auto';
      s.style.backgroundColor = '#ffffff';
    });

    // 4. Calculate exact A4 page slices for each section.
    // Word documents frequently contain 10+ pages within a single <section.docx>.
    // Slicing into precise 210mm x 297mm proportional segments guarantees ZERO squashing!
    interface PageSlice {
      section: HTMLElement;
      y: number;
      height: number;
      pageHeight: number;
      width: number;
      totalH: number;
    }

    const allSlices: PageSlice[] = [];

    for (const section of sections) {
      const w = section.clientWidth || section.offsetWidth || 794;
      const totalH = Math.max(section.scrollHeight, section.offsetHeight, 1123);
      const pageHeight = Math.round(w * (297 / 210)); // Exact A4 aspect ratio (1.4142857)
      const sectionPages = Math.max(1, Math.ceil(totalH / pageHeight));

      for (let p = 0; p < sectionPages; p++) {
        const sliceY = p * pageHeight;
        const sliceH = Math.min(pageHeight, totalH - sliceY);
        allSlices.push({
          section,
          y: sliceY,
          height: sliceH,
          pageHeight,
          width: w,
          totalH,
        });
      }
    }

    const totalPages = allSlices.length;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < totalPages; i++) {
      if (onProgress) {
        onProgress(i + 1, totalPages);
      }

      const slice = allSlices[i];
      const canvas = await html2canvas(slice.section, {
        scale: 2, // 2x scale for crisp text and high-fidelity vector-like rendering
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        x: 0,
        y: slice.y,
        width: slice.width,
        height: slice.height,
        scrollX: 0,
        scrollY: 0,
        windowWidth: slice.width,
        windowHeight: Math.max(slice.totalH + 500, 5000),
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      // Proportional placement on A4:
      // Full width is 210mm.
      // Height is proportional to the slice height (max 297mm) to maintain 100% natural aspect ratio.
      const mmHeight = (slice.height / slice.pageHeight) * 297;
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, mmHeight, undefined, 'FAST');
    }

    return pdf.output('blob');
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Universal PDF converter:
 * 1. Tries server-side native LibreOffice/Word COM API (/api/convert-pdf) with a 25-second timeout.
 * 2. If the server is offline, returns 503, 404, or times out (static websites on Vercel, Netlify, GitHub Pages, etc.),
 *    seamlessly falls back to client-side multi-page A4 slicing converter.
 * 
 * Result: All 10+ pages are preserved with zero distortion and zero squashing!
 */
export async function convertDocxToPdfUniversal(
  blob: Blob,
  onStatusChange?: (status: string) => void
): Promise<Blob> {
  // Step 1: Try server API if reachable (localhost or backend microservice)
  try {
    onStatusChange?.('Converting document with Word engine...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('/api/convert-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blob,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const pdfBlob = await response.blob();
      const arrayBuf = await pdfBlob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuf);
      const header = String.fromCharCode(...uint8.subarray(0, 5));

      if (pdfBlob.size > 0 && header === '%PDF-') {
        return pdfBlob;
      }
    }
  } catch (err) {
    console.warn('Backend PDF endpoint unavailable or timed out. Switching to browser-native engine:', err);
  }

  // Step 2: Reliable browser-native client-side fallback
  onStatusChange?.('Generating multi-page PDF in browser...');
  return await convertDocxToPdfClientSide(blob, (current, total) => {
    onStatusChange?.(`Converting page ${current} of ${total}...`);
  });
}
