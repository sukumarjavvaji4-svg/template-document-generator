import { useEffect, useRef, useState } from 'react';
import {
  Loader2, CheckCircle2, AlertTriangle, FileText, Cpu,
  Link2, Layers, Type, Settings2, Package, ShieldCheck,
} from 'lucide-react';

interface ProgressPhase {
  name: string;
  icon: React.ReactNode;
  minPercent: number;
}

const PHASES: ProgressPhase[] = [
  { name: 'Parsing archives',      icon: <Package size={14} />,     minPercent: 0  },
  { name: 'Analyzing template',    icon: <FileText size={14} />,    minPercent: 12 },
  { name: 'Analyzing data docs',   icon: <Layers size={14} />,      minPercent: 25 },
  { name: 'Managing relationships',icon: <Link2 size={14} />,       minPercent: 38 },
  { name: 'Merging styles',        icon: <Type size={14} />,        minPercent: 47 },
  { name: 'Applying constraints',  icon: <Settings2 size={14} />,   minPercent: 55 },
  { name: 'Generating document',   icon: <Cpu size={14} />,         minPercent: 62 },
  { name: 'Validating',            icon: <ShieldCheck size={14} />, minPercent: 82 },
  { name: 'Packaging',             icon: <Package size={14} />,     minPercent: 90 },
];

interface GenerationProgressProps {
  currentPhase: string;
  percent: number;
  elapsedMs: number;
}

export function GenerationProgress({
  currentPhase,
  percent,
  elapsedMs,
}: GenerationProgressProps) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const formatElapsed = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      {/* Circular progress */}
      <div className="relative mb-8">
        <svg width="140" height="140" className="-rotate-90">
          {/* Background ring */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth="8"
          />
          {/* Progress ring */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke="url(#progressGrad)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
          <defs>
            <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{percent}%</span>
          <span className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">{formatElapsed(elapsedMs)}</span>
        </div>
      </div>

      {/* Current phase */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 mb-3">
          <Loader2 size={14} className="text-blue-600 dark:text-blue-400 animate-spin" />
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{currentPhase}</span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-400">Processing your documents…</p>
      </div>

      {/* Phase checklist */}
      <div className="w-full max-w-sm space-y-2">
        {PHASES.map((phase, idx) => {
          const isDone = percent > phase.minPercent && phase.name !== currentPhase;
          const isActive = phase.name === currentPhase ||
            (percent >= phase.minPercent && !PHASES.slice(idx + 1).some(p => percent >= p.minPercent));

          return (
            <div
              key={phase.name}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                isDone
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/80'
                  : isActive
                    ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/80'
                    : 'bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60'
              }`}
            >
              <span className={`shrink-0 ${
                isDone ? 'text-emerald-600 dark:text-emerald-400' : isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'
              }`}>
                {isDone ? <CheckCircle2 size={14} /> : phase.icon}
              </span>
              <span className={`text-xs font-medium ${
                isDone ? 'text-emerald-700 dark:text-emerald-300' : isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'
              }`}>
                {phase.name}
              </span>
              {isActive && !isDone && (
                <Loader2 size={12} className="ml-auto text-blue-500 dark:text-blue-400 animate-spin" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
