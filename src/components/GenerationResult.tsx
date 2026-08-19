import { useState } from 'react';
import { saveAs } from 'file-saver';
import { renderAsync } from 'docx-preview';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import {
  Download, CheckCircle2, AlertTriangle, XCircle, Info,
  FileText, Files, Clock, ChevronDown, ChevronRight,
  RotateCcw, Settings2, Wrench, BarChart2, Eye, Loader2,
} from 'lucide-react';
import { GenerationReport, ValidationEntry } from '../engine/types';
import { PreviewModal } from './PreviewModal';

interface GenerationResultProps {
  report: GenerationReport;
  blob: Blob;
  fileName: string;
  onStartOver: () => void;
  onEditConstraints: () => void;
}

function ValidationBadge({ entry }: { entry: ValidationEntry }) {
  const config = {
    error:    { cls: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',     icon: <XCircle size={12} /> },
    warning:  { cls: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300', icon: <AlertTriangle size={12} /> },
    repaired: { cls: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',  icon: <Wrench size={12} /> },
    info:     { cls: 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300', icon: <Info size={12} /> },
  }[entry.severity];

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${config.cls}`}>
      <span className="shrink-0 mt-0.5">{config.icon}</span>
      <div className="min-w-0">
        <span className="font-semibold">[{entry.code}]</span>{' '}
        <span>{entry.message}</span>
        {entry.repairDescription && (
          <p className="mt-0.5 opacity-75">↳ {entry.repairDescription}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-700/60 flex items-center justify-center mb-2 text-slate-500 dark:text-slate-400">
        {icon}
      </div>
      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</p>
      <p className="text-xs text-slate-400 dark:text-slate-400 text-center mt-0.5 leading-snug">{label}</p>
    </div>
  );
}

export function GenerationResult({
  report, blob, fileName, onStartOver, onEditConstraints,
}: GenerationResultProps) {
  const [showValidation, setShowValidation] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleDownload = () => {
    saveAs(blob, fileName);
  };

  const convertDocxToPdfClientSide = async (docxBlob: Blob, docxFileName: string): Promise<boolean> => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '800px';
    container.style.background = '#ffffff';
    document.body.appendChild(container);

    try {
      await renderAsync(docxBlob, container, undefined, {
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
      });

      await new Promise(resolve => setTimeout(resolve, 400));

      let pageElements = Array.from(
        container.querySelectorAll('.docx-preview-content section, .docx-wrapper > section, section.docx')
      ) as HTMLElement[];

      if (pageElements.length === 0) {
        pageElements = Array.from(container.querySelectorAll('.docx-wrapper, .docx-preview-content')) as HTMLElement[];
      }

      if (pageElements.length === 0) {
        pageElements = [container];
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }

      const pdfBlob = pdf.output('blob');
      const pdfName = docxFileName.replace(/\.docx$/i, '') + '.pdf';
      saveAs(pdfBlob, pdfName);
      return true;
    } catch (err) {
      console.error('Client-side PDF generation failed:', err);
      return false;
    } finally {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }
  };

  const handleDownloadPdf = async () => {
    setPdfError(null);
    try {
      setIsConvertingPdf(true);

      // Strategy 1: Try server PDF conversion endpoint first
      let serverConverted = false;
      try {
        const response = await fetch('/api/convert-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: blob,
        });

        if (response.ok) {
          const pdfBlob = await response.blob();
          const pdfArrayBuffer = await pdfBlob.arrayBuffer();
          const pdfUint8 = new Uint8Array(pdfArrayBuffer);
          const pdfHeader = String.fromCharCode(...pdfUint8.subarray(0, 5));

          if (pdfUint8.byteLength > 0 && pdfHeader === '%PDF-') {
            const pdfName = fileName.replace(/\.docx$/i, '') + '.pdf';
            saveAs(pdfBlob, pdfName);
            serverConverted = true;
          }
        }
      } catch {
        // Server endpoint not available (e.g. static host, Vercel, offline) -> fallback to browser rendering
      }

      if (serverConverted) return;

      // Strategy 2: Client-Side Web Browser Rendering Engine (100% browser compatible)
      const clientConverted = await convertDocxToPdfClientSide(blob, fileName);
      if (!clientConverted) {
        setPdfError('PDF conversion failed. Your Word document was generated successfully, but PDF conversion is currently unavailable.');
      }
    } catch (err) {
      console.error('PDF conversion error:', err);
      setPdfError('PDF conversion failed. Your Word document was generated successfully, but PDF conversion is currently unavailable.');
    } finally {
      setIsConvertingPdf(false);
    }
  };

  const statusConfig = {
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: <CheckCircle2 size={28} className="text-emerald-500 dark:text-emerald-400" />,
      title: 'Document Generated Successfully',
      subtitle: 'Your document is ready to download and open in Microsoft Word.',
    },
    'success-with-warnings': {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800',
      icon: <AlertTriangle size={28} className="text-amber-500 dark:text-amber-400" />,
      title: 'Generated with Warnings',
      subtitle: `${report.validationReport.warningCount} warning(s) were detected. Review the report below.`,
    },
    failed: {
      bg: 'bg-red-50 dark:bg-red-950/40',
      border: 'border-red-200 dark:border-red-800',
      icon: <XCircle size={28} className="text-red-500 dark:text-red-400" />,
      title: 'Generation Failed Validation',
      subtitle: 'Document generation failed validation. The file was not made available because it may not open correctly in Microsoft Word.',
    },
  }[report.status];

  const allValidationEntries = report.validationReport.entries;
  const hasConstraintConflicts = report.constraintConflicts.length > 0;

  return (
    <div className="animate-fade-in-up max-w-3xl mx-auto w-full px-4 sm:px-6 pt-8 pb-16 space-y-5">

      {/* Status banner */}
      <div className={`p-6 rounded-2xl border ${statusConfig.bg} ${statusConfig.border} flex items-start gap-4`}>
        <div className="shrink-0 mt-0.5 animate-bounce-in">{statusConfig.icon}</div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{statusConfig.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{statusConfig.subtitle}</p>
          {report.status !== 'failed' && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Info size={12} />
              Estimated {report.estimatedPages} page{report.estimatedPages !== 1 ? 's' : ''} —
              final pagination determined by Microsoft Word.
            </div>
          )}
        </div>
      </div>

      {/* Preview + Download buttons */}
      {report.status !== 'failed' && (
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Preview — renders existing blob, no re-generation */}
          <button
            id="preview-btn"
            onClick={() => setShowPreview(true)}
            className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl
              bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-base font-semibold
              shadow-sm hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-300 hover:shadow-md
              active:scale-[0.98] transition-all duration-200"
          >
            <Eye size={20} strokeWidth={2} />
            Preview Document
          </button>

          {/* Download */}
          <button
            id="download-btn"
            onClick={handleDownload}
            className="flex-1 inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl
              bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-base font-semibold
              shadow-lg shadow-blue-200 dark:shadow-indigo-950/50 hover:shadow-xl hover:shadow-blue-300 dark:hover:shadow-indigo-900/60
              hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]
              transition-all duration-200"
          >
            <Download size={20} strokeWidth={2} />
            Download {fileName}
          </button>
        </div>
      )}

      {/* Preview modal — mounted lazily, renders blob when opened */}
      {showPreview && (
        <PreviewModal
          blob={blob}
          fileName={fileName}
          onClose={() => setShowPreview(false)}
          onDownload={handleDownload}
        />
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard label="Est. Pages" value={report.estimatedPages} icon={<FileText size={16} />} />
        <StatCard label="Sections" value={report.sectionsDetected} icon={<Layers size={16} />} />
        <StatCard label="Styles Merged" value={report.stylesMerged} icon={<BarChart2 size={16} />} />
        <StatCard label="Images" value={report.imagesCopied} icon={<Files size={16} />} />
        <StatCard label="Relationships" value={report.relationshipsAdded} icon={<Settings2 size={16} />} />
        <StatCard label="Duration" value={`${(report.durationMs / 1000).toFixed(1)}s`} icon={<Clock size={16} />} />
      </div>

      {/* Constraint conflicts */}
      {hasConstraintConflicts && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
            <AlertTriangle size={14} /> Constraint Notices
          </p>
          <div className="space-y-2">
            {report.constraintConflicts.map((c, i) => (
              <div key={i} className="text-xs text-amber-700 dark:text-amber-300 px-2 py-1.5 bg-white/60 dark:bg-slate-900/60 rounded-lg border border-amber-100 dark:border-amber-900">
                {c.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation report */}
      {allValidationEntries.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <button
            className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            onClick={() => setShowValidation(!showValidation)}
          >
            <ShieldCheck size={18} className="text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
              Validation Report
            </span>
            <div className="flex gap-2 mr-2">
              {report.validationReport.errorCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-xs font-semibold">
                  {report.validationReport.errorCount} error{report.validationReport.errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {report.validationReport.warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                  {report.validationReport.warningCount} warning{report.validationReport.warningCount !== 1 ? 's' : ''}
                </span>
              )}
              {report.validationReport.repairedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                  {report.validationReport.repairedCount} repaired
                </span>
              )}
            </div>
            {showValidation ? <ChevronDown size={15} className="text-slate-400 dark:text-slate-400" /> : <ChevronRight size={15} className="text-slate-400 dark:text-slate-400" />}
          </button>
          {showValidation && (
            <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5 max-h-60 overflow-y-auto animate-fade-in">
              {allValidationEntries.length === 0 ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2">✓ No validation issues found.</p>
              ) : (
                allValidationEntries.map((entry, i) => (
                  <ValidationBadge key={i} entry={entry} />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Strategy log */}
      {report.strategyLog.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <button
            className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
            onClick={() => setShowReport(!showReport)}
          >
            <Wrench size={18} className="text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">Constraint Strategy Log</span>
            {showReport ? <ChevronDown size={15} className="text-slate-400 dark:text-slate-400" /> : <ChevronRight size={15} className="text-slate-400 dark:text-slate-400" />}
          </button>
          {showReport && (
            <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-700/60 space-y-2 animate-fade-in">
              {report.strategyLog.map((log, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl text-xs border ${
                  log.applied
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-800'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                }`}>
                  <span className={`font-bold w-4 text-center ${log.applied ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}>
                    {log.applied ? '✓' : '–'}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{log.strategy}</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">{log.notes}</p>
                  </div>
                  {log.applied && (
                    <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
                      {log.changeCount} change{log.changeCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PDF Error Alert */}
      {pdfError && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-amber-800 dark:text-amber-300 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{pdfError}</span>
          </div>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors shrink-0"
          >
            Download Word Doc
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={onEditConstraints}
          className="flex-1 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-center justify-center gap-2"
        >
          <Settings2 size={16} />
          Edit Constraints
        </button>
        <button
          onClick={onStartOver}
          className="flex-1 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} />
          Start Over
        </button>
        <button
          id="download-pdf-btn"
          onClick={handleDownloadPdf}
          disabled={isConvertingPdf}
          className="flex-1 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConvertingPdf ? (
            <>
              <Loader2 size={16} className="animate-spin text-blue-600 dark:text-blue-400" />
              Converting PDF...
            </>
          ) : (
            <>
              <FileText size={16} />
              Download PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ShieldCheck icon used inside the component
function ShieldCheck({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}

function Layers({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  );
}
