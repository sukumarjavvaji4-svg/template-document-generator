import React, { useCallback, useRef, useState } from 'react';
import {
  Files,
  Upload,
  FileText,
  X,
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

interface FileItemProps {
  file: UploadedFile;
  onRemove: (id: string) => void;
  index: number;
}

function FileItem({ file, onRemove, index }: FileItemProps) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(() => onRemove(file.id), 260);
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border
        transition-all duration-300
        ${removing
          ? 'opacity-0 scale-95 -translate-x-2'
          : 'opacity-100 scale-100 translate-x-0 border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm'
        }
      `}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* File type icon */}
      <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center shrink-0">
        <FileText size={17} className="text-blue-600 dark:text-blue-400" strokeWidth={1.7} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate leading-snug"
          title={file.name}
        >
          {file.name}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">{formatFileSize(file.size)}</p>
      </div>

      {/* Status badge */}
      <span className="hidden sm:flex shrink-0 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold items-center justify-center">
        Data doc ready
      </span>

      {/* Remove button */}
      <button
        onClick={handleRemove}
        title={`Remove ${file.name}`}
        aria-label={`Remove ${file.name}`}
        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 transition-all duration-200 ml-1"
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  );
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

  const processFiles = useCallback(
    (incomingFiles: File[]) => {
      if (dataFiles.length >= MAX_FILES) {
        addToast(
          'warning',
          'Only 1 data document allowed',
          'Remove or replace the current document to select another.'
        );
        return;
      }

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
        onFilesChange([validFiles[0]]); // Strictly 1 file maximum
      }
    },
    [addToast, dataFiles.length, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (isFull) {
        addToast('warning', 'File limit reached', 'Maximum 1 data document allowed.');
        return;
      }
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [addToast, isFull, processFiles]
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

  const handleRemoveFile = (id: string) => {
    onFilesChange(dataFiles.filter((f) => f.id !== id));
  };

  return (
    <div
      className={`
        bg-white dark:bg-slate-800 rounded-2xl border transition-all duration-300
        ${hasError && fileCount === 0
          ? 'border-red-300 dark:border-red-800 shadow-sm shadow-red-100 dark:shadow-red-950/30 animate-shake'
          : 'border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600'
        }
      `}
    >
      {/* Card Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center shrink-0">
            <Files size={20} className="text-indigo-600 dark:text-indigo-400" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 leading-tight">
              Upload your data document (.docx)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              1 file maximum
            </p>
          </div>
          {/* File counter badge */}
          <div className="shrink-0">
            <div
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300
                ${isFull
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                }
              `}
            >
              <span>{fileCount}</span>
              <span className="opacity-50">/</span>
              <span>1</span>
              <span className="ml-0.5 hidden sm:inline font-normal opacity-70">file</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6 space-y-4">
        {/* Drop Zone */}
        {!isFull && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload data documents drop zone"
            onClick={() => !isFull && inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && !isFull && inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative cursor-pointer rounded-xl border-2 border-dashed p-6
              flex flex-col items-center justify-center gap-2.5 text-center
              transition-all duration-200 select-none
              ${isDragOver
                ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 scale-[1.01]'
                : hasError && fileCount === 0
                  ? 'border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20 hover:border-red-400 hover:bg-red-50/50'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20'
              }
            `}
          >
            <div
              className={`
                w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200
                ${isDragOver ? 'bg-indigo-100 dark:bg-indigo-900/60 scale-110' : 'bg-slate-100 dark:bg-slate-700/60'}
              `}
            >
              <Upload
                size={22}
                className={`transition-colors duration-200 ${isDragOver ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-400'}`}
                strokeWidth={1.8}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {isDragOver ? 'Release to upload' : 'Drag & Drop your data document'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                or{' '}
                <span className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Browse</span>
                {' '}— 1 file maximum, .docx only
              </p>
            </div>

            {hasError && fileCount === 0 && (
              <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400 animate-fade-in">
                <FileWarning size={14} />
                <span className="text-xs font-medium">Please upload a data document</span>
              </div>
            )}
          </div>
        )}

        {/* Files List */}
        {dataFiles.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            <div className="space-y-2">
              {dataFiles.map((file, index) => (
                <FileItem
                  key={file.id}
                  file={file}
                  onRemove={handleRemoveFile}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Have multiple data documents? Merge link */}
        <div className="pt-1 flex items-center justify-center sm:justify-start gap-1 text-xs text-slate-500 dark:text-slate-400">
          <span>Have multiple data documents?</span>
          <button
            type="button"
            onClick={onOpenMergeModal}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer ml-1"
          >
            Merge Data Documents
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
          id="data-files-input"
        />
      </div>
    </div>
  );
}
