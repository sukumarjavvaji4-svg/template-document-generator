import { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import JSZip from 'jszip';

interface PreviewModalProps {
  blob: Blob;
  fileName: string;
  onClose: () => void;
  onDownload: () => void;
}

export function PreviewModal({ blob, fileName, onClose, onDownload }: PreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Render DOCX → HTML once on mount using the already-generated blob.
  // Never re-generates the document.
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    renderAsync(blob, container, undefined, {
      className: 'docx-preview-content',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: true,
      experimental: false,
      trimXmlDeclaration: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    })
      .then(async () => {
        // Enhance preview fidelity: Apply page borders from Final.docx XML if present
        await applyPageBorders(blob, container);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setLoading(false);
      });
  }, [blob]);

  const applyPageBorders = async (docBlob: Blob, targetContainer: HTMLElement) => {
    try {
      const zip = await JSZip.loadAsync(docBlob);
      const docXmlStr = await zip.file('word/document.xml')?.async('string');
      if (!docXmlStr) return;

      const parser = new DOMParser();
      const docDom = parser.parseFromString(docXmlStr, 'application/xml');
      const pgBordersList = Array.from(docDom.querySelectorAll('pgBorders'));
      if (pgBordersList.length === 0) return;

      const sections = Array.from(
        targetContainer.querySelectorAll('section.docx, .docx-preview-content section, .docx-preview-wrapper section')
      );

      pgBordersList.forEach((pgBorders, idx) => {
        const sectionEl = (sections[idx] || sections[0]) as HTMLElement;
        if (!sectionEl) return;

        ['top', 'bottom', 'left', 'right'].forEach(dir => {
          const borderEl = pgBorders.querySelector(dir);
          if (borderEl) {
            const val = borderEl.getAttribute('w:val') || borderEl.getAttribute('val');
            const sz = borderEl.getAttribute('w:sz') || borderEl.getAttribute('sz');
            const color = borderEl.getAttribute('w:color') || borderEl.getAttribute('color');

            if (val && val !== 'none' && val !== 'nil') {
              const borderWidth = sz ? `${Math.max(1, Math.round(parseInt(sz, 10) / 8))}px` : '2px';
              const borderColor = color && color !== 'auto' ? `#${color}` : '#000000';
              const borderStyle = val === 'double' ? 'double' : val === 'dashed' ? 'dashed' : val === 'dotted' ? 'dotted' : 'solid';

              const propName = `border${dir.charAt(0).toUpperCase() + dir.slice(1)}`;
              sectionEl.style.setProperty(propName, `${borderWidth} ${borderStyle} ${borderColor}`, 'important');
              sectionEl.style.setProperty('box-sizing', 'border-box', 'important');
            }
          }
        });
      });
    } catch {
      // Non-fatal preview enhancement
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    // Full-screen overlay
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Document Preview"
    >
      {/* ── Top toolbar ────────────────────────────────────────────────── */}
      <div className="flex-none flex items-center justify-between px-5 py-3
                      bg-slate-900 border-b border-slate-700 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{fileName}</p>
            <p className="text-xs text-slate-400">Preview — visual approximation of the generated document</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          {/* Download shortcut inside preview */}
          <button
            id="preview-download-btn"
            onClick={onDownload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl
                       bg-blue-600 hover:bg-blue-700 active:scale-95
                       text-white text-sm font-semibold
                       transition-all duration-150 shadow-md"
          >
            Download
          </button>

          {/* Close */}
          <button
            id="preview-close-btn"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       text-slate-400 hover:text-white hover:bg-slate-700
                       transition-all duration-150"
            aria-label="Close preview"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Preview body ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-950 transition-colors duration-200">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600 dark:text-slate-300">
            <Loader2 size={36} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Rendering preview…</p>
            <p className="text-xs text-slate-400 dark:text-slate-400">This may take a moment for large documents</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center">
              <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Preview rendering failed</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">{error}</p>
              <p className="text-xs text-slate-400 dark:text-slate-400 mt-2">
                The document may still be valid — download it to view in Microsoft Word.
              </p>
            </div>
            <button
              onClick={onDownload}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold
                         hover:bg-blue-700 transition-colors"
            >
              Download instead
            </button>
          </div>
        )}

        {/* DOCX render target */}
        <div
          ref={containerRef}
          className={loading ? 'hidden' : 'docx-preview-wrapper'}
        />
      </div>

      {/* Inline styles for docx-preview theming */}
      <style>{`
        .docx-preview-wrapper {
          min-height: 100%;
          padding: 24px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        /* docx-preview renders .docx sections as divs with class "docx" */
        .docx-preview-content section.docx,
        .docx-preview-content .docx {
          background: #fff;
          box-shadow: 0 4px 24px 0 rgba(0,0,0,0.18);
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
}
