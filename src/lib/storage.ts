import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const PROJECT_FILES_BUCKET = "project-files";
export const EMPLOYEE_CVS_BUCKET = "employee-cvs";
export const TARGET_CLIENT_REPORTS_BUCKET = "target-client-reports";

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

const safeName = (fileName: string) =>
  fileName
    .replace(/^.*[\\/]/, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .slice(-120);

/** `projects/{projectId}/{uuid}-{safeName}` */
export function buildStorageKey(projectId: string, fileName: string): string {
  return `projects/${projectId}/${crypto.randomUUID()}-${safeName(fileName)}`;
}

/** `employees/{employeeId}/{uuid}-{safeName}` */
export function buildCvStorageKey(employeeId: string, fileName: string): string {
  return `employees/${employeeId}/${crypto.randomUUID()}-${safeName(fileName)}`;
}

/** `target-clients/{targetClientId}/{uuid}-{safeName}` */
export function buildTargetClientReportKey(targetClientId: string, fileName: string): string {
  return `target-clients/${targetClientId}/${crypto.randomUUID()}-${safeName(fileName)}`;
}

// ─────────────────── Employee CV validation (نقطة 4.2) ───────────────────

/** PDF / DOC / DOCX, matched by extension + declared MIME + magic bytes. */
export const ACCEPTED_CV_TYPES = [
  {
    ext: ".pdf",
    mimes: ["application/pdf"],
    // "%PDF-"
    magic: [0x25, 0x50, 0x44, 0x46, 0x2d],
  },
  {
    ext: ".docx",
    mimes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
    ],
    // ZIP local file header "PK\x03\x04"
    magic: [0x50, 0x4b, 0x03, 0x04],
  },
  {
    ext: ".doc",
    mimes: ["application/msword"],
    // OLE2 compound file
    magic: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  },
] as const;

export interface CvValidationResult {
  ok: boolean;
  error?: string;
  matchedMime?: string;
}

export function validateCvFile(
  fileName: string,
  declaredMime: string,
  size: number,
  head: Uint8Array,
  maxSize: number,
): CvValidationResult {
  if (size <= 0) return { ok: false, error: "الملف فارغ." };
  if (size > maxSize) {
    const mb = Math.round(maxSize / (1024 * 1024));
    return { ok: false, error: `حجم الملف يتجاوز الحد المسموح (${mb} ميجابايت).` };
  }

  const lower = fileName.toLowerCase();
  const type = ACCEPTED_CV_TYPES.find((t) => lower.endsWith(t.ext));
  if (!type) {
    return { ok: false, error: "نوع الملف غير مدعوم. يُسمح بـ PDF أو DOC أو DOCX." };
  }
  if (declaredMime && !type.mimes.includes(declaredMime as never)) {
    return { ok: false, error: "نوع الملف لا يطابق امتداده." };
  }
  if (!type.magic.every((b, i) => head[i] === b)) {
    return { ok: false, error: "محتوى الملف لا يطابق امتداده." };
  }
  return { ok: true, matchedMime: type.mimes[0] };
}

// ─────────────────────────── Storage helpers ───────────────────────────

export async function uploadToStorage(
  storageKey: string,
  body: ArrayBuffer,
  contentType: string,
  bucket: string = PROJECT_FILES_BUCKET,
) {
  const admin = createAdminClient();
  return admin.storage
    .from(bucket)
    .upload(storageKey, body, { contentType, upsert: false });
}

export async function removeFromStorage(
  storageKey: string | string[],
  bucket: string = PROJECT_FILES_BUCKET,
) {
  const admin = createAdminClient();
  const keys = Array.isArray(storageKey) ? storageKey : [storageKey];
  if (keys.length === 0) return { data: [], error: null };
  return admin.storage.from(bucket).remove(keys);
}

/**
 * Short-lived signed URL. `downloadName` forces a download; omit it to let
 * the browser display the file inline.
 */
export async function createSignedUrl(
  storageKey: string,
  expiresInSeconds = 60,
  downloadName?: string,
  bucket: string = PROJECT_FILES_BUCKET,
) {
  const admin = createAdminClient();
  return admin.storage
    .from(bucket)
    .createSignedUrl(storageKey, expiresInSeconds, {
      download: downloadName ?? false,
    });
}
