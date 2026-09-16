import React, { useCallback, useRef, useState } from 'react';
import {
  FileText,
  FolderOpen,
  CheckCircle2,
  RefreshCw,
  Trash2,
  FileWarning,
} from 'lucide-react';
import { UploadedFile } from '../types';
import { formatFileSize, generateId, isDocxFile } from '../utils';
import { useToast } from '../context/ToastContext';

const MAX_FILES = 1;

interface DataDocumentsCardProps {
  dataFiles: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onOpenMergeModal: () => void;
  hasError?: boolean;
}



export function DataDocumentsCard({
  dataFiles,
  onFilesChange,
  onOpenMergeModal,
  hasError = false,
}: DataDocumentsCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const fileCount = dataFiles.length;
  const isFull = fileCount >= MAX_FILES;

  const currentFile = dataFiles[0] || null;

  const processFiles = useCallback(
    (incomingFiles: File[]) => {
      const validFiles: UploadedFile[] = [];
      const invalidFiles: string[] = [];

      for (const file of incomingFiles) {
        if (!isDocxFile(file)) {
          invalidFiles.push(file.name);
          continue;
        }
        validFiles.push({
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          uploadedAt: new Date(),
        });
      }

      if (invalidFiles.length > 0) {
        addToast(
          'error',
          'Invalid file format',
          'Only .docx files are accepted.'
        );
      }

      if (validFiles.length > 0) {
        onFilesChange([validFiles[0]]);
      }
    },
    [addToast, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [processFiles]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(Array.from(files));
    e.target.value = '';
  };

  const handleRemoveFile = () => {
    onFilesChange([]);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 sm:p-5 transition-all duration-300">
      {/* Section Header */}
      <div className="mb-3.5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Upload Your Word Document
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Drag and drop your .docx file here or browse from your computer.
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          Step 2 of 2
        </span>
      </div>

      {/* Upload Area / Uploaded State */}
      {!isFull ? (
        /* Empty / Dropzone State */
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload Word document drop zone"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            group relative cursor-pointer rounded-xl border-2 border-dashed p-5 sm:p-6
            flex flex-col items-center justify-center text-center select-none
            transition-all duration-200 hover:-translate-y-0.5
            ${isDragOver
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 ring-4 ring-blue-500/10 scale-[1.01]'
              : hasError && fileCount === 0
                ? 'border-red-300 dark:border-red-800/80 bg-red-50/30 dark:bg-red-950/20 hover:border-red-400'
                : 'border-slate-300/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/50 hover:border-blue-500/80 dark:hover:border-blue-400/80 hover:bg-blue-50/20 dark:hover:bg-blue-950/20'
            }
          `}
        >
          {/* Word Icon Container */}
          <div
            className={`
              w-11 h-11 rounded-xl flex items-center justify-center mb-2.5 transition-all duration-200
              ${isDragOver
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105'
                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/60 shadow-2xs group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white'
              }
            `}
          >
            <FileText size={22} strokeWidth={1.8} />
          </div>

          {/* Prompt */}
          <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight mb-0.5">
            {isDragOver ? 'Drop your Word document here' : 'Drag and drop your .docx file here'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            or browse from your computer
          </p>

          {/* Distinct Browse Files button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold shadow-2xs hover:shadow-sm hover:shadow-blue-500/20 transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
          >
            <FolderOpen size={15} strokeWidth={2} />
            <span>Browse Files</span>
          </button>

          {/* Format note */}
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
              .docx files only
            </span>
          </div>

          {/* Error Notice */}
          {hasError && fileCount === 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 font-medium animate-fade-in">
              <FileWarning size={13} />
              <span>Please upload your Word document to proceed</span>
            </div>
          )}
        </div>
      ) : currentFile ? (
        /* Uploaded File Card State */
        <div className="rounded-xl border-2 border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10 p-3.5 sm:p-4 transition-all duration-200 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* File Details */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Document Icon */}
              <div className="relative w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/25 shrink-0">
                <FileText size={20} strokeWidth={2} />
                <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white dark:border-slate-900 shadow-xs">
                  <CheckCircle2 size={11} strokeWidth={3} />
                </span>
              </div>

              {/* Name & Size */}
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate"
                  title={currentFile.name}
                >
                  {currentFile.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  <span className="font-mono text-[11px]">{formatFileSize(currentFile.size)}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400 text-[11px]">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    Ready for generation
                  </span>
                </div>
              </div>
            </div>

            {/* Replace & Remove Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all duration-200 flex items-center gap-1 cursor-pointer"
                title="Choose a different .docx file"
              >
                <RefreshCw size={12} strokeWidth={2} />
                <span>Replace</span>
              </button>

              <button
                type="button"
                onClick={handleRemoveFile}
                className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/40 hover:border-red-300 dark:hover:border-red-800/60 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold shadow-2xs transition-all duration-200 flex items-center gap-1 cursor-pointer"
                title="Remove document"
              >
                <Trash2 size={12} strokeWidth={2} />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Hidden File Input */}
      <input
        ref={inputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        id="data-files-input"
      />

      {/* Multi-document merge helper footer */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Have multiple Word files to merge first?</span>
        <button
          type="button"
          onClick={onOpenMergeModal}
          className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer"
        >
          Merge Data Documents →
        </button>
      </div>
    </div>
  );
}
