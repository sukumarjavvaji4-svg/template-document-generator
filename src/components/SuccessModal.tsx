import { useEffect } from 'react';
import { CheckCircle2, X, Sparkles, FileText, Files, ArrowRight } from 'lucide-react';
import { UploadedFile } from '../types';
import { formatFileSize } from '../utils';

interface SuccessModalProps {
  templateFile: UploadedFile;
  dataFiles: UploadedFile[];
  onClose: () => void;
  onContinue: () => void;
}

export function SuccessModal({
  templateFile,
  dataFiles,
  onClose,
  onContinue,
}: SuccessModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        {/* Gradient top band */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close success dialog"
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200 z-10"
        >
          <X size={18} />
        </button>

        <div className="p-8">
          {/* Success icon */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center animate-bounce-in">
                <CheckCircle2 size={40} className="text-emerald-500" strokeWidth={1.8} />
              </div>
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center animate-bounce-in" style={{ animationDelay: '100ms' }}>
                <Sparkles size={14} className="text-white" strokeWidth={2} />
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <h3
              id="success-modal-title"
              className="text-xl font-bold text-slate-800 mb-2 leading-tight"
            >
              Documents Uploaded Successfully!
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Ready for document generation. Your template and data documents are prepared.
            </p>
          </div>

          {/* Summary */}
          <div className="space-y-3 mb-7">
            {/* Template */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-blue-600" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-0.5">
                  Template
                </p>
                <p className="text-sm text-slate-700 font-medium truncate" title={templateFile.name}>
                  {templateFile.name}
                </p>
              </div>
              <span className="text-xs text-slate-400 shrink-0">
                {formatFileSize(templateFile.size)}
              </span>
            </div>

            {/* Data files */}
            <div className="px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <Files size={16} className="text-indigo-600" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                    Data Documents
                  </p>
                  <p className="text-xs text-slate-500">{dataFiles.length} file{dataFiles.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="space-y-1.5 pl-11">
                {dataFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                    <span className="text-xs text-slate-600 truncate flex-1" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">{formatFileSize(file.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
            >
              Go Back
            </button>
            <button
              onClick={onContinue}
              id="success-continue-btn"
              className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold
                hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]
                shadow-lg shadow-blue-200 hover:shadow-blue-300
                transition-all duration-200 flex items-center justify-center gap-2"
            >
              Begin Generation
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
