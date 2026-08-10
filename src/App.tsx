import { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, FileCheck2, ChevronRight, Loader2 } from 'lucide-react';
import { UploadedFile } from './types';
import { ToastProvider, useToast } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeToggle } from './components/ThemeToggle';
import { ToastContainer } from './components/ToastContainer';
import { TemplateUploadCard } from './components/TemplateUploadCard';
import { DataDocumentsCard } from './components/DataDocumentsCard';
import { MergeDataDocsModal } from './components/MergeDataDocsModal';
import { GenerationProgress } from './components/GenerationProgress';
import { GenerationResult } from './components/GenerationResult';
import { UserConstraints, GenerationReport, DEFAULT_CONSTRAINTS } from './engine/types';
import { generateDocument } from './engine/pipeline';

type AppStage = 1 | 2 | 3;

interface GenerationState {
  phase: string;
  percent: number;
  startMs: number;
  elapsedMs: number;
}

interface GenerationOutput {
  report: GenerationReport;
  blob: Blob;
  fileName: string;
}

// ─── Stage 1: Upload ──────────────────────────────────────────────────────────

function UploadStage({
  templateFile, dataFiles, onTemplateChange, onDataFilesChange, onContinue,
}: {
  templateFile: UploadedFile | null;
  dataFiles: UploadedFile[];
  onTemplateChange: (f: UploadedFile | null) => void;
  onDataFilesChange: (f: UploadedFile[]) => void;
  onContinue: () => void;
}) {
  const [templateError, setTemplateError] = useState(false);
  const [dataError, setDataError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const { addToast } = useToast();

  const hasTemplate = !!templateFile;
  const hasData = dataFiles.length > 0;
  const isReady = hasTemplate && hasData;

  const handleTemplateChange = useCallback((file: UploadedFile | null) => {
    onTemplateChange(file);
    if (file) setTemplateError(false);
  }, [onTemplateChange]);

  const handleDataFilesChange = useCallback((files: UploadedFile[]) => {
    onDataFilesChange(files);
    if (files.length > 0) setDataError(false);
  }, [onDataFilesChange]);

  const handleContinue = () => {
    const missingTemplate = !templateFile;
    const missingData = dataFiles.length === 0;
    setTemplateError(missingTemplate);
    setDataError(missingData);

    if (missingTemplate || missingData) {
      if (missingTemplate && missingData) {
        addToast('error', 'Documents required', 'Please upload both a template and a data document.');
      } else if (missingTemplate) {
        addToast('error', 'Template missing', 'Please upload a template document (.docx) to continue.');
      } else {
        addToast('error', 'Data document missing', 'Please upload a data document (.docx) to continue.');
      }
      return;
    }

    setIsLoading(true);
    setTimeout(() => { setIsLoading(false); onContinue(); }, 400);
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-10 pb-16">
      <div className="text-center mb-10 animate-fade-in-up">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
          Upload Your Documents
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
          Upload the required documents to begin the{' '}
          <span className="text-blue-600 dark:text-blue-400 font-medium">document generation</span> process.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 mb-6">
        <div className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <TemplateUploadCard
            templateFile={templateFile}
            onFileChange={handleTemplateChange}
            hasError={templateError}
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <DataDocumentsCard
            dataFiles={dataFiles}
            onFilesChange={handleDataFilesChange}
            onOpenMergeModal={() => setIsMergeModalOpen(true)}
            hasError={dataError}
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between animate-fade-in-up" style={{ animationDelay: '180ms' }}>
        <div className="text-xs text-slate-400 dark:text-slate-500">
          {!hasTemplate && !hasData && 'Upload both documents to continue'}
          {!hasTemplate && hasData && 'Upload template document to continue'}
          {hasTemplate && !hasData && 'Upload data document to continue'}
          {isReady && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <FileCheck2 size={13} />
              All requirements met — ready to generate
            </span>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={isLoading}
          className={`
            flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-semibold
            transition-all duration-300 shadow-md cursor-pointer select-none
            ${isReady
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-200 dark:shadow-indigo-950/50 hover:shadow-lg hover:shadow-blue-300 dark:hover:shadow-indigo-900/60 active:scale-[0.98]'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
            }
          `}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin text-white" />
              <span>Preparing...</span>
            </>
          ) : (
            <>
              <span>Generate Document</span>
              <ChevronRight size={16} strokeWidth={2.5} />
            </>
          )}
        </button>
      </div>

      {/* Multi-Document Merge Modal */}
      {isMergeModalOpen && (
        <MergeDataDocsModal
          onClose={() => setIsMergeModalOpen(false)}
          onUseMergedDocument={(mergedDocFile: UploadedFile) => {
            onDataFilesChange([mergedDocFile]);
            setIsMergeModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Main App Content ─────────────────────────────────────────────────────────

function AppContent() {
  const [stage, setStage] = useState<AppStage>(1);
  const [templateFile, setTemplateFile] = useState<UploadedFile | null>(null);
  const [dataFiles, setDataFiles] = useState<UploadedFile[]>([]);
  const [genState, setGenState] = useState<GenerationState>({
    phase: 'Initializing',
    percent: 0,
    startMs: 0,
    elapsedMs: 0,
  });
  const [output, setOutput] = useState<GenerationOutput | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const { addToast } = useToast();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleGenerate = async (constraints: UserConstraints) => {
    if (!templateFile || dataFiles.length === 0) return;

    setStage(3);
    setOutput(null);
    setGenError(null);

    const start = Date.now();
    setGenState({ phase: 'Reading files', percent: 5, startMs: start, elapsedMs: 0 });

    timerRef.current = window.setInterval(() => {
      setGenState(prev => ({ ...prev, elapsedMs: Date.now() - prev.startMs }));
    }, 100);

    try {
      const result = await generateDocument(
        templateFile.file,
        dataFiles.map(d => d.file),
        constraints,
        (phase, percent) => {
          setGenState(prev => ({ ...prev, phase, percent }));
        }
      );

      setOutput({ report: result.report, blob: result.blob, fileName: result.fileName });
      if (timerRef.current) clearInterval(timerRef.current);

      if (result.report.status === 'success') {
        addToast('success', 'Document generated!', 'Your Final.docx is ready to download.');
      } else if (result.report.status === 'success-with-warnings') {
        addToast('warning', 'Generated with warnings', `${result.report.validationReport.warningCount} warning(s) detected.`);
      }
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      const message = err instanceof Error ? err.message : String(err);
      setGenError(message);
      addToast('error', 'Generation failed', message.slice(0, 100));
    }
  };

  const STEPS = [
    { label: 'Upload',   stepNumber: 1, stage: 1 },
    { label: 'Generate', stepNumber: 2, stage: 3 },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-100 dark:opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(148,163,184,0.12) 1px, transparent 0)`,
          backgroundSize: '28px 28px',
        }}
        aria-hidden="true"
      />

      {/* Top accent */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 z-40" />

      {/* Header */}
      <header className="relative z-10 border-b border-slate-200/60 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm transition-colors duration-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200 dark:shadow-indigo-950">
                <Zap size={17} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                  Document Generator
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Stage {stage === 1 ? 1 : 2} of 2 — {stage === 1 ? 'Upload' : 'Generate'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right side: Step indicator + Theme Toggle */}
            <div className="flex items-center gap-3">
              {/* Step indicator */}
              <div className="hidden md:flex items-center gap-1.5">
                {STEPS.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                      s.stage === stage
                        ? 'bg-blue-600 text-white shadow-sm'
                        : s.stage < stage
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}>
                      <span>{s.stepNumber}</span>
                      <span>{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && <ChevronRight size={12} className="text-slate-300 dark:text-slate-700" />}
                  </div>
                ))}
              </div>

              {/* Theme Toggle */}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col">
        {stage === 1 && (
          <UploadStage
            templateFile={templateFile}
            dataFiles={dataFiles}
            onTemplateChange={setTemplateFile}
            onDataFilesChange={setDataFiles}
            onContinue={() => handleGenerate(DEFAULT_CONSTRAINTS)}
          />
        )}

        {stage === 3 && (
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-8 pb-16">
            {!output && !genError ? (
              <GenerationProgress
                currentPhase={genState.phase}
                percent={genState.percent}
                elapsedMs={genState.elapsedMs}
              />
            ) : genError ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 animate-fade-in-up">
                <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-800 flex items-center justify-center">
                  <span className="text-2xl text-red-600 dark:text-red-400">✗</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Generation Failed</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{genError}</p>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => { setStage(1); setGenError(null); }}
                    className="px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    ← Back to Upload
                  </button>
                  <button
                    onClick={() => { setStage(1); setGenError(null); setTemplateFile(null); setDataFiles([]); }}
                    className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            ) : output ? (
              <GenerationResult
                report={output.report}
                blob={output.blob}
                fileName={output.fileName}
                onStartOver={() => {
                  setStage(1); setOutput(null); setTemplateFile(null); setDataFiles([]);
                }}
                onEditConstraints={() => { setStage(1); setOutput(null); }}
              />
            ) : null}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-100 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm py-4 transition-colors duration-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
          <span>Document Generator — XML-Based OOXML Engine</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            All processing is done securely in your browser — no uploads
          </span>
        </div>
      </footer>

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}
