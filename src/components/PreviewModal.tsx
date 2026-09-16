import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  AlertTriangle,
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { renderAsync } from 'docx-preview';

interface PreviewModalProps {
  blob: Blob;
  fileName: string;
  onClose: () => void;
  onDownload: () => void;
}

export function PreviewModal({ blob, fileName, onClose, onDownload }: PreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    setUseFallback(false);

    async function loadPreview() {
      // 1. Primary high-fidelity renderer:
      // Request native Word/LibreOffice A4 paginated render from the local endpoint with a 3.5s timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch('/api/convert-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: blob,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const pdfBlob = await response.blob();
          const arrayBuf = await pdfBlob.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuf);
          const header = String.fromCharCode(...uint8.subarray(0, 5));

          if (pdfBlob.size > 0 && header === '%PDF-') {
            if (!isMounted) return;
            createdUrl = URL.createObjectURL(pdfBlob);
            setPdfUrl(createdUrl);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Native Word rendering service unavailable or timed out, falling back to client-side renderer:', e);
      }

      // 2. Client-side fallback renderer (docx-preview)
      // If server-side Word COM is unavailable, render full OOXML client-side without truncation
      if (!isMounted) return;
      setUseFallback(true);

      if (containerRef.current) {
        const container = containerRef.current;
        container.innerHTML = '';

        try {
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
          if (isMounted) setLoading(false);
        } catch (err: unknown) {
          if (!isMounted) return;
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [blob]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent background scrolling while preview modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col w-screen h-screen bg-black/90 backdrop-blur-md animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Document Preview"
    >
      {/* ── Top Toolbar ────────────────────────────────────────────────── */}
      <div className="flex-none flex items-center justify-between px-5 py-2.5 bg-slate-900 border-b border-slate-700/80 shadow-md">
        {/* Document Title & Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">{fileName}</p>
              <span className="px-2 py-0.5 rounded-md bg-blue-950/80 border border-blue-800/60 text-blue-300 text-xs font-medium">
                Word Print Layout
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Microsoft Word Paginated Preview</p>
          </div>
        </div>

        {/* Toolbar Center / Right Controls */}
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2 py-1 text-xs text-slate-300">
            <button
              onClick={() => setZoomLevel(prev => Math.max(50, prev - 15))}
              className="p-1 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut size={15} />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="px-2 py-0.5 hover:text-white hover:bg-slate-700 rounded-lg font-mono text-[11px] font-semibold transition-colors cursor-pointer"
              title="Fit to page / Reset"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.min(150, prev + 15))}
              className="p-1 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn size={15} />
            </button>
          </div>

          {/* Download original DOCX */}
          <button
            id="preview-download-btn"
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl
                       bg-blue-600 hover:bg-blue-700 active:scale-95
                       text-white text-xs font-semibold
                       transition-all duration-150 shadow-md cursor-pointer"
          >
            <Download size={14} />
            Download .docx
          </button>

          {/* Close button */}
          <button
            id="preview-close-btn"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl
                       text-slate-400 hover:text-white hover:bg-slate-800
                       transition-all duration-150 cursor-pointer"
            aria-label="Close preview"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Preview Body: Office Desk Canvas ────────────────────────────── */}
      <div className="flex-1 overflow-hidden bg-slate-900 flex flex-col items-center justify-center relative">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-300">
            <Loader2 size={38} className="animate-spin text-blue-400" />
            <p className="text-sm font-semibold text-white">Rendering Word Document Pages…</p>
            <p className="text-xs text-slate-400">Formatting exact A4 layout, headers, footers, tables, and borders</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-800/80 flex items-center justify-center">
              <AlertTriangle size={24} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Preview rendering failed</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">{error}</p>
              <p className="text-xs text-slate-400 mt-2">
                The document may still be valid — download it to view in Microsoft Word.
              </p>
            </div>
            <button
              onClick={onDownload}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md cursor-pointer"
            >
              Download Word Document
            </button>
          </div>
        )}

        {/* 1. Primary Word Print Layout View (via native Word/LibreOffice PDF engine) */}
        {!loading && pdfUrl && (
          <div className="w-full h-full flex flex-col bg-[#323639]">
            <object
              key={zoomLevel}
              data={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=Fit${zoomLevel !== 100 ? `&zoom=${zoomLevel}` : ''}`}
              type="application/pdf"
              className="w-full h-full border-0"
            >
              <iframe
                src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=Fit${zoomLevel !== 100 ? `&zoom=${zoomLevel}` : ''}`}
                className="w-full h-full border-0"
                title={fileName}
              />
            </object>
          </div>
        )}

        {/* 2. Client-Side Fallback View (docx-preview) */}
        <div
          className={`w-full h-full overflow-auto py-8 px-4 flex flex-col items-center docx-preview-scroll-pane ${
            !loading && useFallback ? 'block' : 'hidden'
          }`}
        >
          <div
            ref={containerRef}
            className="w-full flex flex-col items-center transition-transform duration-150"
            style={{
              transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
              transformOrigin: 'top center',
            }}
          />
        </div>
      </div>

      {/* Modern Word Document Fallback Styles */}
      <style>{`
        .docx-preview-scroll-pane {
          scrollbar-width: thin;
          scrollbar-color: #475569 #1e293b;
        }
        .docx-preview-scroll-pane::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .docx-preview-scroll-pane::-webkit-scrollbar-track {
          background: #1e293b;
        }
        .docx-preview-scroll-pane::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 4px;
        }
        .docx-preview-scroll-pane::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }

        .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        .docx-preview-content section.docx,
        .docx-wrapper > section.docx {
          background: #ffffff !important;
          width: 210mm !important;
          max-width: 100% !important;
          min-height: 297mm !important;
          box-sizing: border-box !important;
          box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.12) !important;
          margin: 0 auto 24px auto !important;
          position: relative !important;
        }
      `}</style>
    </div>,
    document.body
  );
}

