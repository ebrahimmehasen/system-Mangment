/** Human-readable file size, e.g. "1.4 ميجابايت". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} كيلوبايت`;
  return `${(kb / 1024).toFixed(1)} ميجابايت`;
}
