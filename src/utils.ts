/**
 * Format a file size in bytes to a human-readable string (KB / MB / GB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)} ${sizes[i]}`;
}

/**
 * Generate a unique ID using crypto.randomUUID (or fallback)
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Check if a file is a valid .docx file
 */
export function isDocxFile(file: File): boolean {
  const validMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  const validExtensions = ['.docx'];
  const hasValidMime = validMimeTypes.includes(file.type);
  const hasValidExtension = validExtensions.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );
  // Accept if either mime type OR extension is valid (some browsers may not set mime correctly)
  return hasValidMime || hasValidExtension;
}
