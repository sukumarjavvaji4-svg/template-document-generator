import React, { useCallback, useRef, useState } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  X,
  RefreshCw,
  FileWarning,
} from 'lucide-react';
import { UploadedFile } from '../types';
import { formatFileSize, generateId, isDocxFile } from '../utils';
import { useToast } from '../context/ToastContext';

interface TemplateUploadCardProps {
  templateFile: UploadedFile | null;
  onFileChange: (file: UploadedFile | null) => void;
  hasError?: boolean;
}

export function TemplateUploadCard({
  templateFile,
  onFileChange,
  hasError = false,
}: TemplateUploadCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const processFile = useCallback(
    (file: File) => {
      if (!isDocxFile(file)) {
        addToast(
          'error',
          'Invalid file type',
          `"${file.name}" is not a .docx file. Please upload a Word document.`
        );
        return;
      }
      const uploaded: UploadedFile = {
        id: generateId(),
        file,
        name: file.name,
        size: file.size,
        uploadedAt: new Date(),
      };
      onFileChange(uploaded);
      if (templateFile) {
        addToast('info', 'Template replaced', `"${file.name}" is now your template.`);
      }
    },
    [addToast, onFileChange, templateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      if (files.length > 1) {
        addToast('warning', 'Only one template allowed', 'Please drop a single .docx file.');
      }
      processFile(files[0]);
    },
    [addToast, processFile]
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
    processFile(files[0]);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const handleRemove = () => {
    onFileChange(null);
    setIsReplacing(false);
  };

  const handleReplace = () => {
    inputRef.current?.click();
  };

  return (
    <div
      className={`
        bg-white dark:bg-slate-800 rounded-2xl border transition-all duration-300
        ${hasError && !templateFile
          ? 'border-red-300 dark:border-red-800 shadow-sm shadow-red-100 dark:shadow-red-950/30 animate-shake'
          : 'border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600'
        }
      `}
    >
      {/* Card Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center">
            <FileText size={20} className="text-blue-600 dark:text-blue-400" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 leading-tight">
              Template Document
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Upload the template document (.docx)</p>
          </div>
          {templateFile && (
            <div className="ml-auto">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                <CheckCircle2 size={12} strokeWidth={2.5} />
                Uploaded
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6">
        {!templateFile ? (
          /* Drop Zone */
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload template document drop zone"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative cursor-pointer rounded-xl border-2 border-dashed p-8
              flex flex-col items-center justify-center gap-3 text-center
              transition-all duration-200 select-none
              ${isDragOver
                ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-950/40 scale-[1.01]'
                : hasError
                  ? 'border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20 hover:border-red-400 hover:bg-red-50/50'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/30'
              }
            `}
          >
            <div
              className={`
                w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200
                ${isDragOver ? 'bg-blue-100 dark:bg-blue-900/60 scale-110' : 'bg-slate-100 dark:bg-slate-700/60'}
              `}
            >
              <Upload
                size={24}
                className={`transition-colors duration-200 ${isDragOver ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-400'}`}
                strokeWidth={1.8}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {isDragOver ? 'Release to upload' : 'Drag & Drop your template here'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">
                or{' '}
                <span className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Browse</span>
                {' '}to choose a file
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <FileText size={12} className="text-slate-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">.docx files only</span>
            </div>
            {hasError && (
              <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400 animate-fade-in">
                <FileWarning size={14} />
                <span className="text-xs font-medium">Please upload a template document</span>
              </div>
            )}
          </div>
        ) : (
          /* Uploaded State */
          <div className="animate-fade-in-up">
            <div
              className={`
                flex items-center gap-4 p-4 rounded-xl border transition-all duration-300
                ${isReplacing
                  ? 'border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/40'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900'
                }
              `}
            >
              {/* File Icon */}
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center">
                  <FileText size={22} className="text-blue-600 dark:text-blue-400" strokeWidth={1.6} />
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800 flex items-center justify-center shadow-sm">
                  <CheckCircle2 size={11} className="text-white" strokeWidth={3} />
                </div>
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={templateFile.name}>
                  {templateFile.name}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                  {formatFileSize(templateFile.size)}
                  <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleReplace}
                  title="Replace template"
                  aria-label="Replace template file"
                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-200"
                >
                  <RefreshCw size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={handleRemove}
                  title="Remove template"
                  aria-label="Remove template file"
                  className="p-2 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 transition-all duration-200"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
          id="template-file-input"
        />
      </div>
    </div>
  );
}
