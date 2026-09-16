import React, { useState, useRef, useCallback } from 'react';
import {
  X,
  Upload,
  FileText,
  ArrowUp,
  ArrowDown,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  Layers,
  Sparkles,
} from 'lucide-react';
import { UploadedFile } from '../types';
import { formatFileSize, generateId, isDocxFile } from '../utils';
import { useToast } from '../context/ToastContext';
import { DataDocMerger, MergeDataDocsResult } from '../engine/modules/DataDocMerger';
import { PreviewModal } from './PreviewModal';

const MAX_MERGE_FILES = 5;

interface MergeDataDocsModalProps {
  onClose: () => void;
  onUseMergedDocument: (file: UploadedFile) => void;
}

interface MergeDocItem {
  id: string;
  file: File;
  name: string;
  size: number;
}

export function MergeDataDocsModal({
  onClose,
  onUseMergedDocument,
}: MergeDataDocsModalProps) {
  const [items, setItems] = useState<MergeDocItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<MergeDataDocsResult | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ blob: Blob; fileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  // ─── File Upload Handler ──────────────────────────────────────────────────

  const processIncomingFiles = useCallback(
    (incomingFiles: File[]) => {
      const validFiles: MergeDocItem[] = [];
      const invalidNames: string[] = [];
      const duplicateNames: string[] = [];

      const currentCount = items.length;

      for (const file of incomingFiles) {
        if (!isDocxFile(file)) {
          invalidNames.push(file.name);
          continue;
        }

        if (items.some((it) => it.name === file.name)) {
          duplicateNames.push(file.name);
          continue;
        }

        validFiles.push({
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
        });
      }

      if (invalidNames.length > 0) {
        addToast(
          'error',
          'Invalid file format',
          `Only .docx files are accepted: ${invalidNames.slice(0, 2).join(', ')}`
        );
      }

      if (duplicateNames.length > 0) {
        addToast(
          'warning',
          'Duplicate file skipped',
          `"${duplicateNames[0]}" is already in the merge list.`
        );
      }

      if (currentCount + validFiles.length > MAX_MERGE_FILES) {
        addToast(
          'warning',
          'File limit reached',
          `Maximum ${MAX_MERGE_FILES} data documents allowed.`
        );
      }

      const available = MAX_MERGE_FILES - currentCount;
      const allowedToAdd = validFiles.slice(0, Math.max(0, available));

      if (allowedToAdd.length > 0) {
        setItems((prev) => [...prev, ...allowedToAdd]);
        setMergeResult(null); // Reset previous merge result if list changes
      }
    },
    [items, addToast]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    processIncomingFiles(droppedFiles);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processIncomingFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  // ─── Document Reordering ──────────────────────────────────────────────────

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const nextItems = [...items];
    const temp = nextItems[index];
    nextItems[index] = nextItems[targetIdx];
    nextItems[targetIdx] = temp;

    setItems(nextItems);
    setMergeResult(null);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setMergeResult(null);
  };

  // ─── Merge Action ─────────────────────────────────────────────────────────

  const handleMerge = async () => {
    if (items.length < 2) {
      addToast(
        'warning',
        'Multiple files required',
        'Please upload at least 2 data documents to merge.'
      );
      return;
    }

    setIsMerging(true);
    setMergeResult(null);

    try {
      const filesToMerge = items.map((it) => it.file);
      const res = await DataDocMerger.merge(filesToMerge);
      setIsMerging(false);

      if (res.valid) {
        setMergeResult(res);
        addToast(
          'success',
          'Documents merged',
          `Successfully merged ${items.length} documents into MergedData.docx.`
        );
      } else {
        setMergeResult(res);
        addToast(
          'error',
          'Merge failed',
          res.errors[0] || 'Failed to generate valid merged DOCX package.'
        );
      }
    } catch (err) {
      setIsMerging(false);
      const msg = err instanceof Error ? err.message : String(err);
      addToast('error', 'Merge execution failed', msg);
    }
  };

  // ─── Use Merged Document Handler ─────────────────────────────────────────

  const handleUseMergedDocument = () => {
    if (!mergeResult || !mergeResult.valid) return;

    const uploadedFile: UploadedFile = {
      id: generateId(),
      file: mergeResult.file,
      name: 'MergedData.docx',
      size: mergeResult.blob.size,
      uploadedAt: new Date(),
    };

    onUseMergedDocument(uploadedFile);
    addToast(
      'success',
      'Merged data document ready',
      'MergedData.docx is set as your data document.'
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Merge Data Documents</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Combine 2 to 5 data documents (.docx) in sequence into a single data document
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Upload Dropzone */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleInputChange}
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            className="hidden"
          />

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => items.length < MAX_MERGE_FILES && fileInputRef.current?.click()}
            className={`
              p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-200
              ${isDragOver
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 scale-[0.99]'
                : items.length >= MAX_MERGE_FILES
                ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 opacity-60 cursor-not-allowed'
                : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50/40 dark:bg-slate-900/40 hover:bg-blue-50/20 dark:hover:bg-blue-950/20'
              }
            `}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-100/60 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
              <Upload size={22} />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {items.length >= MAX_MERGE_FILES
                ? 'Maximum 5 files reached'
                : 'Upload the data documents you want to merge'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">
              Drag & drop or <span className="text-blue-600 dark:text-blue-400 font-medium">browse</span> (2 to 5 .docx files)
            </p>
          </div>

          {/* List of Files to Merge */}
          {items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Documents Order ({items.length} / {MAX_MERGE_FILES})
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">Order determines merge sequence</span>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm"
                  >
                    {/* Index Badge */}
                    <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    {/* File Icon & Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-400">{formatFileSize(item.size)}</p>
                    </div>

                    {/* Item Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ blob: item.file, fileName: item.name })}
                        title="Preview this document"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                      >
                        <Eye size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => moveItem(idx, 'up')}
                        disabled={idx === 0}
                        title="Move Up"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(idx, 'down')}
                        disabled={idx === items.length - 1}
                        title="Move Down"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                      >
                        <ArrowDown size={15} />
                      </button>

                      {/* Remove Action */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        title="Remove"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Merge Success / Output Section */}
          {mergeResult && mergeResult.valid && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">MergedData.docx Ready</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Valid DOCX package created ({formatFileSize(mergeResult.blob.size)})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPreviewDoc({ blob: mergeResult.blob, fileName: 'MergedData.docx' })}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                >
                  <Eye size={14} />
                  Preview
                </button>

                <button
                  type="button"
                  onClick={handleUseMergedDocument}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-md shadow-emerald-200 dark:shadow-emerald-950/50 transition-all active:scale-95"
                >
                  <Sparkles size={14} />
                  Use as Data Document
                </button>
              </div>
            </div>
          )}

          {/* Merge Error Section */}
          {mergeResult && !mergeResult.valid && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3 text-red-700 dark:text-red-400 text-xs">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Failed to generate merged document</p>
                {mergeResult.errors.map((err, i) => (
                  <p key={i} className="mt-0.5">• {err}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleMerge}
            disabled={items.length < 2 || isMerging}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200 dark:shadow-indigo-950/50 transition-all active:scale-95"
          >
            {isMerging ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Merging Documents...
              </>
            ) : (
              'Merge Documents'
            )}
          </button>
        </div>
      </div>

      {/* Word-style Preview Modal for individual or merged document */}
      {previewDoc && (
        <PreviewModal
          blob={previewDoc.blob}
          fileName={previewDoc.fileName}
          onClose={() => setPreviewDoc(null)}
          onDownload={() => {
            const url = URL.createObjectURL(previewDoc.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = previewDoc.fileName;
            a.click();
            URL.revokeObjectURL(url);
          }}
        />
      )}
    </div>
  );
}
