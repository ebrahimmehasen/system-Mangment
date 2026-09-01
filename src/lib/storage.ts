import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const PROJECT_FILES_BUCKET = "project-files";

/**
 * Phase 1 accepts PDF only. Adding a type here (plus the DB `file_type`
 * and the bucket's allowed_mime_types) is all it takes to extend later.
 */
export const ACCEPTED_FILE_TYPES = [
  {
    mime: "application/pdf",
    ext: ".pdf",
    // "%PDF-"
    magic: [0x25, 0x50, 0x44, 0x46, 0x2d],
  },
] as const;

export interface FileValidationResult {
  ok: boolean;
  error?: string;
  matchedExt?: string;
  matchedMime?: string;
}

/**
 * Validate an uploaded file by extension, declared MIME type, size, and
 * (most importantly) its leading magic bytes — so an HTML/JS file renamed
 * to .pdf is rejected.
 */
export function validateUploadedFile(
  fileName: string,
  declaredMime: string,
  size: number,
  head: Uint8Array,
  maxSize: number,
): FileValidationResult {
  if (size <= 0) return { ok: false, error: "الملف فارغ." };
  if (size > maxSize) {
    const mb = Math.round(maxSize / (1024 * 1024));
    return { ok: false, error: `حجم الملف يتجاوز الحد المسموح (${mb} ميجابايت).` };
  }

  const lower = fileName.toLowerCase();
  const type = ACCEPTED_FILE_TYPES.find((t) => lower.endsWith(t.ext));
  if (!type) {
    return { ok: false, error: "نوع الملف غير مدعوم. يُسمح بملفات PDF فقط." };
  }
  if (declaredMime && declaredMime !== type.mime) {
    return { ok: false, error: "نوع الملف لا يطابق امتداده." };
  }
  const magicOk = type.magic.every((b, i) => head[i] === b);
  if (!magicOk) {
    return { ok: false, error: "محتوى الملف لا يطابق نوع PDF." };
  }

  return { ok: true, matchedExt: type.ext, matchedMime: type.mime };
}

/** `projects/{projectId}/{uuid}-{safeName}` */
export function buildStorageKey(projectId: string, fileName: string): string {
  const safe = fileName
    .replace(/^.*[\\/]/, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .slice(-120);
  return `projects/${projectId}/${crypto.randomUUID()}-${safe}`;
}

export async function uploadToStorage(
  storageKey: string,
  body: ArrayBuffer,
  contentType: string,
) {
  const admin = createAdminClient();
  return admin.storage
    .from(PROJECT_FILES_BUCKET)
    .upload(storageKey, body, { contentType, upsert: false });
}

export async function removeFromStorage(storageKey: string | string[]) {
  const admin = createAdminClient();
  const keys = Array.isArray(storageKey) ? storageKey : [storageKey];
  if (keys.length === 0) return { data: [], error: null };
  return admin.storage.from(PROJECT_FILES_BUCKET).remove(keys);
}

/**
 * Short-lived signed URL. `downloadName` forces a download; omit it to let
 * the browser display the PDF inline.
 */
export async function createSignedUrl(
  storageKey: string,
  expiresInSeconds = 60,
  downloadName?: string,
) {
  const admin = createAdminClient();
  return admin.storage
    .from(PROJECT_FILES_BUCKET)
    .createSignedUrl(storageKey, expiresInSeconds, {
      download: downloadName ?? false,
    });
}
