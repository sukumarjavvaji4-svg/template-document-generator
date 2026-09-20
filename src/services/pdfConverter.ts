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
 * Validates whether a given Blob is a valid non-empty PDF binary (%PDF-).
 */
export async function isValidPdfBlob(blob: Blob | null | undefined): Promise<boolean> {
  if (!blob || blob.size < 500) return false;
  try {
    const slice = blob.slice(0, 8);
    const arrayBuf = await slice.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuf);
    const header = String.fromCharCode(...uint8.subarray(0, 5));
    return header === '%PDF-';
  } catch {
    return false;
  }
}

/**
 * Proactively pings the cloud PDF conversion microservice to wake it up
 * so that when the user clicks 'Preview' or 'Download PDF', the service is already hot and responds in seconds.
 */
export function warmUpPdfService(): void {
  try {
    fetch('https://template-document-generator.onrender.com/health', {
      method: 'GET',
      mode: 'cors',
    }).catch(() => {});
  } catch {}
}

/**
 * High-Fidelity Word/LibreOffice PDF Engine:
 * Connects directly to native conversion engines for 100% Microsoft Word visual fidelity:
 * - On Localhost: uses local Vite PowerShell Word COM automation plugin.
 * - On Live Website: calls the dedicated Render LibreOffice service directly (bypassing Vercel proxy timeouts).
 * - Fallback: relative proxy endpoint.
 */
export async function fetchHighFidelityPdf(
  blob: Blob,
  onStatusChange?: (status: string) => void,
  timeoutMs = 55000
): Promise<Blob | null> {
  const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Strategy 1 (Localhost): Use local Vite plugin with native Word COM / LibreOffice
  if (isLocal) {
    try {
      onStatusChange?.('Converting with local Word engine...');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 25000));
      const res = await fetch('/api/convert-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: blob,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const pdfBlob = await res.blob();
        if (await isValidPdfBlob(pdfBlob)) return pdfBlob;
      }
    } catch (e) {
      console.warn('Local Word COM conversion unavailable:', e);
    }
  }

  // Strategy 2 (Web / Production): Call the dedicated LibreOffice cloud service directly
  // Direct HTTPS call avoids Vercel 10s gateway proxy timeouts and preserves full Word layout.
  const RENDER_DIRECT_URL = 'https://template-document-generator.onrender.com/api/convert-pdf';
  try {
    onStatusChange?.('Connecting to Word conversion engine...');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Realistic milestone feedback while document converts
    const t1 = setTimeout(() => onStatusChange?.('Formatting Microsoft Word layout...'), 3500);
    const t2 = setTimeout(() => onStatusChange?.('Rendering tables, borders & styling...'), 12000);
    const t3 = setTimeout(() => onStatusChange?.('Finalizing PDF document...'), 22000);

    const res = await fetch(RENDER_DIRECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blob,
      signal: controller.signal,
    });

    clearTimeout(timer);
    clearTimeout(t1);
    clearTimeout(t2);
    clearTimeout(t3);

    if (res.ok) {
      const pdfBlob = await res.blob();
      if (await isValidPdfBlob(pdfBlob)) return pdfBlob;
    }
  } catch (e) {
    console.warn('Direct cloud conversion unavailable or timed out:', e);
  }

  // Strategy 3: Relative Vercel proxy fallback
  if (!isLocal) {
    try {
      onStatusChange?.('Connecting via proxy...');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/convert-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: blob,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const pdfBlob = await res.blob();
        if (await isValidPdfBlob(pdfBlob)) return pdfBlob;
      }
    } catch (e) {
      console.warn('Proxy conversion unavailable:', e);
    }
  }

  return null;
}

/**
 * Universal PDF converter:
 * 1. Executes fetchHighFidelityPdf to guarantee 100% Microsoft Word layout, borders, and fonts.
 * 2. If completely offline, falls back to the client-side precision A4 multi-page slicing engine.
 */
export async function convertDocxToPdfUniversal(
  blob: Blob,
  onStatusChange?: (status: string) => void
): Promise<Blob> {
  const highFidelityPdf = await fetchHighFidelityPdf(blob, onStatusChange, 55000);
  if (highFidelityPdf) {
    return highFidelityPdf;
  }

  // Fallback for complete offline mode
  onStatusChange?.('Generating multi-page PDF in browser...');
  return await convertDocxToPdfClientSide(blob, (current, total) => {
    onStatusChange?.(`Converting page ${current} of ${total}...`);
  });
}
