import { useState } from 'react';
import { saveAs } from 'file-saver';

import {
  Download, CheckCircle2, AlertTriangle, XCircle, Info,
  FileText, ChevronDown, ChevronRight,
  RotateCcw, Settings2, Wrench, Eye, Loader2,
  ShieldCheck,
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

import { convertDocxToPdfUniversal } from '../services/pdfConverter';

export function GenerationResult({
  report, blob, fileName, onStartOver, onEditConstraints,
}: GenerationResultProps) {
  const [showValidation, setShowValidation] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [cachedPdfBlob, setCachedPdfBlob] = useState<Blob | null>(null);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const [conversionStatus, setConversionStatus] = useState<string>('Converting PDF...');
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleDownload = () => {
    saveAs(blob, fileName);
  };

  const handleDownloadPdf = async () => {
    setPdfError(null);
    const pdfName = fileName.replace(/\.docx$/i, '') + '.pdf';

    // If PDF is already loaded or cached from preview, download immediately
    if (cachedPdfBlob) {
      saveAs(cachedPdfBlob, pdfName);
      return;
    }

    try {
      setIsConvertingPdf(true);
      setConversionStatus('Connecting to Word engine...');

      // High-Fidelity Universal PDF Engine: Tries native server/cloud endpoint;
      // automatically falls back to browser-native A4 engine if offline.
      const pdfBlob = await convertDocxToPdfUniversal(blob, (status) => {
        setConversionStatus(status);
      });

      setCachedPdfBlob(pdfBlob);
      saveAs(pdfBlob, pdfName);
    } catch (err) {
      console.error('PDF conversion failed:', err);
      setPdfError('PDF conversion encountered an issue. You can still download the Word document.');
    } finally {
      setIsConvertingPdf(false);
      setConversionStatus('Converting PDF...');
    }
  };

  const isFailed = report.status === 'failed';
  const hasWarnings = report.status === 'success-with-warnings';

  const allValidationEntries = report.validationReport.entries;
  const hasConstraintConflicts = report.constraintConflicts.length > 0;

  return (
    <div className="animate-fade-in-up w-full space-y-4">
      {/* 1. Main Document Ready Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-6 transition-all duration-300">
        {/* Success Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              isFailed
                ? 'bg-red-50 dark:bg-red-950/60 border border-red-200/80 dark:border-red-800/80 text-red-600 dark:text-red-400'
                : hasWarnings
                  ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/80 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400'
            }`}>
              {isFailed ? (
                <XCircle size={22} strokeWidth={2.2} />
              ) : hasWarnings ? (
                <AlertTriangle size={22} strokeWidth={2.2} />
              ) : (
                <CheckCircle2 size={22} strokeWidth={2.2} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {isFailed ? 'Generation Failed' : 'Document Ready'}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  isFailed
                    ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200/60 dark:border-red-800/60'
                    : hasWarnings
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isFailed ? 'bg-red-500' : hasWarnings ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
                  {isFailed ? 'Validation failed' : hasWarnings ? `Generated with ${report.validationReport.warningCount} warning(s)` : 'DOCX generated successfully'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {isFailed
                  ? 'Document generation failed validation. The file was not made available because it may not open correctly.'
                  : 'Your document has been generated successfully and is ready to preview or download.'}
              </p>
            </div>
          </div>

          <div className="shrink-0 self-start sm:self-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs font-mono text-slate-600 dark:text-slate-300">
              <FileText size={12} className="text-blue-500 shrink-0" />
              <span className="truncate max-w-[150px] sm:max-w-[200px]" title={fileName}>{fileName}</span>
            </span>
          </div>
        </div>

        {/* 2. Compact Clickable Preview Placeholder (No automatic first-page rendering) */}
        {!isFailed && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="group w-full py-3 px-4 sm:px-5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/30 dark:bg-slate-950/40 dark:hover:bg-blue-950/20 transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer text-left shadow-2xs hover:shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <FileText size={17} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Document Preview
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    A4 paginated Word document layout
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform shrink-0">
                <span>Click to view document preview</span>
                <span className="text-sm font-bold">→</span>
              </div>
            </button>
          </div>
        )}

        {/* 3. Primary Document Actions */}
        {!isFailed && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              {/* Preview Document Button */}
              <button
                id="preview-btn"
                type="button"
                onClick={() => setShowPreview(true)}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm hover:bg-blue-50/30 dark:hover:bg-blue-950/30 shadow-2xs transition-all duration-200 cursor-pointer active:scale-[0.98]"
              >
                <Eye size={16} strokeWidth={2} className="text-blue-600 dark:text-blue-400" />
                <span>Preview Document</span>
              </button>

              {/* Download DOCX Button */}
              <button
                id="download-btn"
                type="button"
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 text-white font-bold text-xs sm:text-sm shadow-sm shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
                <Download size={16} strokeWidth={2.2} />
                <span>Download DOCX</span>
              </button>
            </div>
          </div>
        )}
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs">
          <button
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            onClick={() => setShowValidation(!showValidation)}
          >
            <ShieldCheck size={16} className="text-slate-500 dark:text-slate-400" />
            <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
              Validation Report
            </span>
            <div className="flex gap-1.5 mr-2">
              {report.validationReport.errorCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-[11px] font-semibold">
                  {report.validationReport.errorCount} error{report.validationReport.errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {report.validationReport.warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[11px] font-semibold">
                  {report.validationReport.warningCount} warning{report.validationReport.warningCount !== 1 ? 's' : ''}
                </span>
              )}
              {report.validationReport.repairedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[11px] font-semibold">
                  {report.validationReport.repairedCount} repaired
                </span>
              )}
            </div>
            {showValidation ? <ChevronDown size={14} className="text-slate-400 dark:text-slate-400" /> : <ChevronRight size={14} className="text-slate-400 dark:text-slate-400" />}
          </button>
          {showValidation && (
            <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 max-h-56 overflow-y-auto animate-fade-in">
              {allValidationEntries.length === 0 ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium py-1.5">✓ No validation issues found.</p>
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs">
          <button
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            onClick={() => setShowReport(!showReport)}
          >
            <Wrench size={16} className="text-slate-500 dark:text-slate-400" />
            <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">Constraint Strategy Log</span>
            {showReport ? <ChevronDown size={14} className="text-slate-400 dark:text-slate-400" /> : <ChevronRight size={14} className="text-slate-400 dark:text-slate-400" />}
          </button>
          {showReport && (
            <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-2 animate-fade-in">
              {report.strategyLog.map((log, i) => (
                <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg text-xs border ${
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
                    <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-[10px]">
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
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-amber-800 dark:text-amber-300 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{pdfError}</span>
          </div>
          <button
            onClick={handleDownload}
            className="px-2.5 py-1 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors shrink-0"
          >
            Download Word Doc
          </button>
        </div>
      )}

      {/* 4. Action Bar (Edit Constraints, Start Over, Download PDF) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-0.5">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Edit Constraints */}
          <button
            type="button"
            onClick={onEditConstraints}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Settings2 size={14} />
            <span>Edit Constraints</span>
          </button>

          {/* Start Over */}
          <button
            type="button"
            onClick={onStartOver}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RotateCcw size={14} />
            <span>Start Over</span>
          </button>
        </div>

        {/* Download PDF (stronger visual treatment) */}
        <button
          id="download-pdf-btn"
          type="button"
          onClick={handleDownloadPdf}
          disabled={isConvertingPdf}
          className="w-full sm:w-auto px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConvertingPdf ? (
            <>
              <Loader2 size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
              <span>{conversionStatus}</span>
            </>
          ) : (
            <>
              <FileText size={14} />
              <span>Download PDF</span>
            </>
          )}
        </button>
      </div>

      {/* 5. Preview Modal (renders existing PreviewModal lazily) */}
      {showPreview && (
        <PreviewModal
          blob={blob}
          fileName={fileName}
          onClose={() => setShowPreview(false)}
          onDownload={handleDownload}
          cachedPdfBlob={cachedPdfBlob}
          onPdfLoaded={(loadedBlob) => setCachedPdfBlob(loadedBlob)}
        />
      )}
    </div>
  );
}
