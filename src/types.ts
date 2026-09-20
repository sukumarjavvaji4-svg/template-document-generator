export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  uploadedAt: Date;
  isPdfSource?: boolean;
  originalName?: string;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type TemplateType = 'onesided' | 'twosided';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
}

