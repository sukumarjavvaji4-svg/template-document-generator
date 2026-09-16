import React from 'react';
import { FileText, BookOpen, Check } from 'lucide-react';
import { TemplateType } from '../types';

interface TemplateUploadCardProps {
  selectedTemplate: TemplateType;
  onSelectTemplate: (type: TemplateType) => void;
}

const TEMPLATE_OPTIONS: {
  id: TemplateType;
  title: string;
  subtitle: string;
  fileName: string;
  badge: string;
  icon: typeof FileText;
}[] = [
  {
    id: 'onesided',
    title: 'ONE-SIDED',
    subtitle: 'Standard single-sided document',
    fileName: 'vnrvjiet-onesided.docx',
    badge: 'Standard Layout',
    icon: FileText,
  },
  {
    id: 'twosided',
    title: 'TWO-SIDED',
    subtitle: 'Front & back / booklet document',
    fileName: 'vnrvjiet-twosided.docx',
    badge: 'Duplex / Booklet',
    icon: BookOpen,
  },
];

export function TemplateUploadCard({
  selectedTemplate,
  onSelectTemplate,
}: TemplateUploadCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 sm:p-5 transition-all duration-300">
      {/* Section Header */}
      <div className="mb-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Choose Layout
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select your printing and header format
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            Step 1 of 2
          </span>
        </div>
      </div>

      {/* Selectable Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TEMPLATE_OPTIONS.map((opt) => {
          const isSelected = selectedTemplate === opt.id;
          const Icon = opt.icon;

          return (
            <div
              key={opt.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => onSelectTemplate(opt.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectTemplate(opt.id);
                }
              }}
              className={`
                group relative cursor-pointer rounded-xl p-3.5 sm:p-4 border-2 transition-all duration-200 select-none
                flex flex-col justify-between hover:-translate-y-0.5
                ${isSelected
                  ? 'border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 shadow-sm shadow-blue-500/10 ring-2 ring-blue-500/20 dark:ring-blue-400/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800/80 shadow-2xs hover:shadow-xs'
                }
              `}
            >
              {/* Top Row: Icon & Check Indicator */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div
                    className={`
                      w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200
                      ${isSelected
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                      }
                    `}
                  >
                    <Icon size={18} strokeWidth={2} />
                  </div>

                  {/* Radio / Check Circle */}
                  <div
                    className={`
                      w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200
                      ${isSelected
                        ? 'bg-blue-600 text-white scale-100 shadow-xs'
                        : 'border-2 border-slate-300 dark:border-slate-600 bg-transparent'
                      }
                    `}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>

                {/* Typography Hierarchy */}
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-wide mb-0.5">
                  {opt.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2.5">
                  {opt.subtitle}
                </p>
              </div>

              {/* Template File Pill */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[140px]">
                  {opt.fileName}
                </span>
                <span
                  className={`
                    text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded
                    ${isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }
                  `}
                >
                  {opt.badge}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

