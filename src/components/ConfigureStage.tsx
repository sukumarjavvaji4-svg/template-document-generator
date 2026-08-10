import { useState } from 'react';
import {
  Settings2, ChevronRight, ChevronDown, FileText, Files,
  Layers, Image, Table2, Type, AlignLeft, Link2, Repeat2,
  AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import {
  UserConstraints, ConstraintStrategy, TemplateScope,
  StyleConflictRule, HeaderFooterRule, PageBreakRule,
  ImageHandling, TableHandling, DEFAULT_CONSTRAINTS,
  ConstraintConflict,
} from '../engine/types';
import { UploadedFile } from '../types';

interface ConfigureStageProps {
  templateFile: UploadedFile;
  dataFiles: UploadedFile[];
  onGenerate: (constraints: UserConstraints) => void;
  onBack: () => void;
}

const STRATEGY_LABELS: Record<ConstraintStrategy, string> = {
  'resize-images': 'Resize Images',
  'reduce-paragraph-spacing': 'Reduce Paragraph Spacing',
  'reduce-line-spacing': 'Reduce Line Spacing',
  'reduce-table-padding': 'Reduce Table Padding',
  'reduce-font-size': 'Reduce Font Size',
};

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ icon, title, subtitle, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <button
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        {open
          ? <ChevronDown size={16} className="text-slate-400 dark:text-slate-400" />
          : <ChevronRight size={16} className="text-slate-400 dark:text-slate-400" />
        }
      </button>
      {open && (
        <div className="px-6 pb-5 pt-1 border-t border-slate-100 dark:border-slate-700/60 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

function RadioGroup<T extends string>({
  label, options, value, onChange, name,
}: {
  label?: string;
  options: Array<{ value: T; label: string; description?: string }>;
  value: T;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">{label}</p>}
      {options.map(opt => (
        <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
          value === opt.value
            ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40'
            : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-200 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-900'
        }`}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="mt-0.5 accent-blue-600 dark:accent-blue-500"
          />
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{opt.label}</p>
            {opt.description && <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">{opt.description}</p>}
          </div>
        </label>
      ))}
    </div>
  );
}

export function ConfigureStage({ templateFile, dataFiles, onGenerate, onBack }: ConfigureStageProps) {
  const [constraints, setConstraints] = useState<UserConstraints>(DEFAULT_CONSTRAINTS);
  const update = <K extends keyof UserConstraints>(key: K, val: UserConstraints[K]) =>
    setConstraints(prev => ({ ...prev, [key]: val }));

  const moveStrategy = (idx: number, dir: -1 | 1) => {
    const arr = [...constraints.constraintStrategies];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    update('constraintStrategies', arr);
  };

  return (
    <div className="animate-fade-in-up max-w-3xl mx-auto w-full px-4 sm:px-6 pt-8 pb-16">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">Configure Generation</h1>
        <p className="text-slate-500 dark:text-slate-400 text-base">
          Set constraints and rules for combining{' '}
          <span className="font-medium text-blue-600 dark:text-blue-400">{templateFile.name}</span>{' '}
          with {dataFiles.length} data document{dataFiles.length !== 1 ? 's' : ''}.
        </p>
      </div>

      <div className="space-y-4">

        {/* Template Application */}
        <CollapsibleSection
          icon={<Layers size={18} className="text-blue-600 dark:text-blue-400" />}
          title="Template Application"
          subtitle="Where to apply the template layout"
        >
          <RadioGroup<TemplateScope>
            name="templateScope"
            value={constraints.templateScope}
            onChange={v => update('templateScope', v)}
            options={[
              { value: 'all', label: 'Entire document', description: 'Apply template layout to all pages' },
              { value: 'first-page', label: 'First page only', description: 'Template header/footer on first page only' },
              { value: 'last-page', label: 'Last page only', description: 'Template layout on the last page only' },
              { value: 'odd-pages', label: 'Odd pages only', description: 'Template applied to odd-numbered pages' },
              { value: 'even-pages', label: 'Even pages only', description: 'Template applied to even-numbered pages' },
            ]}
          />
        </CollapsibleSection>

        {/* Page Limit */}
        <CollapsibleSection
          icon={<AlignLeft size={18} className="text-indigo-600 dark:text-indigo-400" />}
          title="Page Limit & Compression"
          subtitle="Attempt to fit content within a page limit"
        >
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-colors">
              <input
                type="checkbox"
                checked={constraints.pageLimitEnabled}
                onChange={e => update('pageLimitEnabled', e.target.checked)}
                className="accent-blue-600 dark:accent-blue-500 w-4 h-4"
              />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Enable page limit</p>
                <p className="text-xs text-slate-400 dark:text-slate-400">Apply compression strategies to target a page count</p>
              </div>
            </label>

            {constraints.pageLimitEnabled && (
              <div className="space-y-3 pl-1 animate-fade-in">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-600 dark:text-slate-300 font-medium w-32 shrink-0">Max pages:</label>
                  <input
                    type="number"
                    min={1} max={500}
                    value={constraints.maxPages}
                    onChange={e => update('maxPages', Number(e.target.value))}
                    className="w-24 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none"
                  />
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex gap-2">
                  <Info size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Page estimates are advisory only. Final pagination is determined by Microsoft Word.
                  </p>
                </div>

                {/* Strategy priority list */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Compression Priority (drag or reorder)
                  </p>
                  <div className="space-y-1.5">
                    {constraints.constraintStrategies.map((strategy, idx) => (
                      <div key={strategy} className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-bold text-slate-400 w-5 text-center">{idx + 1}</span>
                        <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 font-medium">{STRATEGY_LABELS[strategy]}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveStrategy(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-30 transition-colors"
                            title="Move up"
                          >▲</button>
                          <button
                            onClick={() => moveStrategy(idx, 1)}
                            disabled={idx === constraints.constraintStrategies.length - 1}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-30 transition-colors"
                            title="Move down"
                          >▼</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Min font size (pt)</label>
                    <input
                      type="number" min={6} max={72}
                      value={constraints.minFontSizePt}
                      onChange={e => update('minFontSizePt', Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Min image scale (%)</label>
                    <input
                      type="number" min={10} max={100}
                      value={constraints.minImageScalePercent}
                      onChange={e => update('minImageScalePercent', Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Style Conflicts */}
        <CollapsibleSection
          icon={<Type size={18} className="text-violet-600 dark:text-violet-400" />}
          title="Style Conflict Resolution"
          subtitle="How to handle styles with identical names"
          defaultOpen={false}
        >
          <RadioGroup<StyleConflictRule>
            name="styleConflict"
            value={constraints.styleConflictRule}
            onChange={v => update('styleConflictRule', v)}
            options={[
              { value: 'prefer-template', label: 'Prefer template style', description: 'When names conflict, keep the template definition' },
              { value: 'prefer-data', label: 'Prefer data style', description: 'When names conflict, use the data document definition' },
              { value: 'auto-rename', label: 'Auto-rename conflicts', description: 'Rename data styles (e.g., "Heading1_data") and preserve both' },
            ]}
          />
        </CollapsibleSection>

        {/* Header/Footer */}
        <CollapsibleSection
          icon={<Link2 size={18} className="text-emerald-600 dark:text-emerald-400" />}
          title="Header & Footer"
          subtitle="Which document's headers and footers to use"
          defaultOpen={false}
        >
          <RadioGroup<HeaderFooterRule>
            name="headerFooter"
            value={constraints.headerFooterRule}
            onChange={v => update('headerFooterRule', v)}
            options={[
              { value: 'use-template', label: 'Use template header/footer', description: 'Apply the template headers and footers to all pages' },
              { value: 'use-data', label: 'Use data document header/footer', description: 'Keep headers/footers from the data documents' },
              { value: 'ignore-data', label: 'Ignore data header/footer', description: 'Use template only, discard data document headers/footers' },
            ]}
          />
        </CollapsibleSection>

        {/* Page Breaks */}
        <CollapsibleSection
          icon={<Repeat2 size={18} className="text-orange-600 dark:text-orange-400" />}
          title="Page Break Rules"
          subtitle="How to handle page breaks in data documents"
          defaultOpen={false}
        >
          <RadioGroup<PageBreakRule>
            name="pageBreaks"
            value={constraints.pageBreakRule}
            onChange={v => update('pageBreakRule', v)}
            options={[
              { value: 'preserve', label: 'Preserve original page breaks', description: 'Keep all page breaks from data documents exactly as-is' },
              { value: 'remove', label: 'Remove page breaks', description: 'Strip all page break elements from data documents' },
              { value: 'after-sections', label: 'Insert after sections', description: 'Add page breaks between data document sections' },
              { value: 'keep-together', label: 'Keep paragraphs together', description: 'Add keepNext to prevent orphaned lines' },
            ]}
          />
        </CollapsibleSection>

        {/* Image Handling */}
        <CollapsibleSection
          icon={<Image size={18} className="text-sky-600 dark:text-sky-400" />}
          title="Image Handling"
          subtitle="How to size and position images from data documents"
          defaultOpen={false}
        >
          <RadioGroup<ImageHandling>
            name="imageHandling"
            value={constraints.imageHandling}
            onChange={v => update('imageHandling', v)}
            options={[
              { value: 'preserve', label: 'Preserve original size', description: 'Keep images at their original dimensions' },
              { value: 'fit-margins', label: 'Fit within margins', description: 'Scale images down if they exceed page margins' },
              { value: 'scale-proportional', label: 'Scale proportionally', description: 'Scale all images proportionally to fit constraints' },
            ]}
          />
        </CollapsibleSection>

        {/* Table Handling */}
        <CollapsibleSection
          icon={<Table2 size={18} className="text-teal-600 dark:text-teal-400" />}
          title="Table Handling"
          subtitle="Options for tables in data documents"
          defaultOpen={false}
        >
          <div className="space-y-2">
            <RadioGroup<TableHandling>
              name="tableHandling"
              value={constraints.tableHandling}
              onChange={v => update('tableHandling', v)}
              options={[
                { value: 'preserve', label: 'Preserve table widths', description: 'Keep original table column widths' },
                { value: 'auto-fit', label: 'Auto-fit within margins', description: 'Resize tables to fit within page margins' },
              ]}
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={constraints.preventRowSplitting}
                  onChange={e => update('preventRowSplitting', e.target.checked)}
                  className="accent-blue-600 dark:accent-blue-500"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Prevent row splitting</span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={constraints.repeatHeaderRows}
                  onChange={e => update('repeatHeaderRows', e.target.checked)}
                  className="accent-blue-600 dark:accent-blue-500"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Repeat header rows</span>
              </label>
            </div>
          </div>
        </CollapsibleSection>

        {/* Merge Settings */}
        <CollapsibleSection
          icon={<Files size={18} className="text-blue-600 dark:text-blue-400" />}
          title="Document Merge"
          subtitle="How to join multiple data documents"
          defaultOpen={false}
        >
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:bg-white dark:hover:bg-slate-900 transition-colors">
              <input
                type="checkbox"
                checked={constraints.insertSectionBreakBetweenDocs}
                onChange={e => update('insertSectionBreakBetweenDocs', e.target.checked)}
                className="accent-blue-600 dark:accent-blue-500 w-4 h-4"
              />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Insert section break between documents</p>
                <p className="text-xs text-slate-400 dark:text-slate-400">Start each data document on a new page/section</p>
              </div>
            </label>
            {constraints.insertSectionBreakBetweenDocs && (
              <div className="pl-1 animate-fade-in">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Break type</p>
                <select
                  value={constraints.sectionBreakType}
                  onChange={e => update('sectionBreakType', e.target.value as UserConstraints['sectionBreakType'])}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900"
                >
                  <option value="nextPage">Next Page</option>
                  <option value="continuous">Continuous</option>
                  <option value="evenPage">Even Page</option>
                  <option value="oddPage">Odd Page</option>
                </select>
              </div>
            )}
          </div>
        </CollapsibleSection>

      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 mt-8">
        <button
          onClick={onBack}
          className="flex-1 sm:flex-none px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
        >
          ← Back
        </button>
        <button
          id="generate-btn"
          onClick={() => onGenerate(constraints)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl
            bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold
            shadow-lg shadow-blue-200 dark:shadow-indigo-950/50 hover:shadow-xl hover:shadow-blue-300 dark:hover:shadow-indigo-900/60
            hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]
            transition-all duration-200"
        >
          <Settings2 size={18} strokeWidth={2} />
          Generate Document
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
