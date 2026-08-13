export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  uploadedAt: Date;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
}
