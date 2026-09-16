import { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, FileCheck2, ChevronRight, Loader2 } from 'lucide-react';
import { UploadedFile, TemplateType } from './types';
import { ToastProvider, useToast } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeToggle } from './components/ThemeToggle';
import { ToastContainer } from './components/ToastContainer';
import { TemplateUploadCard } from './components/TemplateUploadCard';
import { DataDocumentsCard } from './components/DataDocumentsCard';
import { MergeDataDocsModal } from './components/MergeDataDocsModal';
import { GenerationProgress } from './components/GenerationProgress';
import { GenerationResult } from './components/GenerationResult';
import { EngineeringBackground } from './components/EngineeringBackground';
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
  selectedTemplate, onSelectTemplate, dataFiles, onDataFilesChange, onContinue,
}: {
  selectedTemplate: TemplateType;
  onSelectTemplate: (t: TemplateType) => void;
  dataFiles: UploadedFile[];
  onDataFilesChange: (f: UploadedFile[]) => void;
  onContinue: () => void;
}) {
  const [dataError, setDataError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const { addToast } = useToast();

  const hasData = dataFiles.length > 0;
  const isReady = hasData && Boolean(selectedTemplate);

  const handleDataFilesChange = useCallback((files: UploadedFile[]) => {
    onDataFilesChange(files);
    if (files.length > 0) setDataError(false);
  }, [onDataFilesChange]);

  const handleContinue = () => {
    if (!selectedTemplate) {
      addToast('error', 'Layout missing', 'Please select a document layout (One-Sided or Two-Sided).');
      return;
    }
    if (dataFiles.length === 0) {
      setDataError(true);
      addToast('error', 'Document missing', 'Please upload your Word document (.docx) to continue.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => { setIsLoading(false); onContinue(); }, 400);
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pt-6 pb-12">
      {/* Hero Section */}
      <div className="text-center mb-6 animate-fade-in-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
          Create Your Document
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          Choose a document layout and upload your Word document to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6">
        <div className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <TemplateUploadCard
            selectedTemplate={selectedTemplate}
            onSelectTemplate={onSelectTemplate}
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

      {/* Action CTA */}
      <div className="animate-fade-in-up flex flex-col items-center gap-2.5 pt-1" style={{ animationDelay: '180ms' }}>
        <button
          onClick={handleContinue}
          disabled={!isReady || isLoading}
          className={`
            group w-full sm:w-auto min-w-[240px] sm:min-w-[280px] flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm sm:text-base font-bold
            transition-all duration-300 shadow-sm select-none
            ${isReady
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 text-white shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none border border-slate-300/40 dark:border-slate-800'
            }
          `}
        >
          {isLoading ? (
            <>
              <Loader2 size={20} className="animate-spin text-white" />
              <span>Preparing Generation...</span>
            </>
          ) : (
            <>
              <Zap
                size={20}
                className={`transition-transform duration-200 ${
                  isReady ? 'text-amber-300 fill-amber-300 group-hover:scale-110' : 'text-slate-400'
                }`}
              />
              <span>Generate Document</span>
              <ChevronRight
                size={18}
                strokeWidth={2.5}
                className={`transition-transform duration-200 ${
                  isReady ? 'group-hover:translate-x-1' : ''
                }`}
              />
            </>
          )}
        </button>

        {/* Status Indicator */}
        <div className="text-xs text-slate-400 dark:text-slate-500 text-center">
          {!isReady ? (
            <span>Upload a Word document (.docx) to enable generation</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Layout selected & document ready — ready to generate
            </span>
          )}
        </div>
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
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('onesided');
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
    if (dataFiles.length === 0) return;

    setStage(3);
    setOutput(null);
    setGenError(null);

    const start = Date.now();
    setGenState({ phase: 'Loading template', percent: 5, startMs: start, elapsedMs: 0 });

    timerRef.current = window.setInterval(() => {
      setGenState(prev => ({ ...prev, elapsedMs: Date.now() - prev.startMs }));
    }, 100);

    try {
      const templateFileName = selectedTemplate === 'onesided'
        ? 'vnrvjiet-onesided.docx'
        : 'vnrvjiet-twosided.docx';

      const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      const primaryUrl = `${baseUrl}/templates/${templateFileName}`;

      let templateRes = await fetch(primaryUrl);
      if (!templateRes.ok) {
        // Fallback relative fetch in case of non-standard base URL hosting
        templateRes = await fetch(`./templates/${templateFileName}`);
      }
      if (!templateRes.ok) {
        templateRes = await fetch(`/templates/${templateFileName}`);
      }
      if (!templateRes.ok) {
        throw new Error(`Failed to load template "${templateFileName}" (HTTP ${templateRes.status})`);
      }
      const templateBlob = await templateRes.blob();
      const templateFile = new File([templateBlob], templateFileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const result = await generateDocument(
        templateFile,
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
    <div className="min-h-screen text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200 relative selection:bg-blue-500/20 selection:text-blue-600 dark:selection:text-blue-400">
      {/* Precision Engineering Blueprint Background System */}
      <EngineeringBackground />

      {/* Top technical accent line */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500 z-40" />

      {/* Header */}
      <header className="relative z-10 border-b border-slate-200/60 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm transition-colors duration-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0">
                <Zap size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Document Generator
                  </span>
                  <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
                    VNR VJIET
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Stage {stage === 1 ? 1 : 2} of 2 — {stage === 1 ? 'Upload & Layout' : 'Generate & Export'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right side: Step indicator + Theme Toggle */}
            <div className="flex items-center gap-3">
              {/* Step indicator */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                {STEPS.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-1">
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                      s.stage === stage
                        ? 'bg-blue-600 text-white shadow-sm'
                        : s.stage < stage
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-slate-500 dark:text-slate-400 font-normal'
                    }`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        s.stage === stage
                          ? 'bg-white/20 text-white font-bold'
                          : s.stage < stage
                            ? 'bg-emerald-500 text-white font-bold'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {s.stage < stage ? '✓' : s.stepNumber}
                      </span>
                      <span>{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && <ChevronRight size={12} className="text-slate-400 dark:text-slate-600 mx-0.5" />}
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
            selectedTemplate={selectedTemplate}
            onSelectTemplate={setSelectedTemplate}
            dataFiles={dataFiles}
            onDataFilesChange={setDataFiles}
            onContinue={() => handleGenerate(DEFAULT_CONSTRAINTS)}
          />
        )}

        {stage === 3 && (
          <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pt-6 pb-12">
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
                    onClick={() => { setStage(1); setGenError(null); setDataFiles([]); }}
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
                  setStage(1); setOutput(null); setDataFiles([]);
                }}
                onEditConstraints={() => { setStage(1); setOutput(null); }}
              />
            ) : null}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-100 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm py-3.5 transition-colors duration-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
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
