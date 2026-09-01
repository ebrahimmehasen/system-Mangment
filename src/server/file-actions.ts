"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { serverEnv } from "@/lib/env";
import {
  buildStorageKey,
  removeFromStorage,
  uploadToStorage,
  validateUploadedFile,
} from "@/lib/storage";

export interface FileActionState {
  error?: string;
  success?: string;
}

export async function uploadProjectFileAction(
  projectId: string,
  _prev: FileActionState,
  formData: FormData,
): Promise<FileActionState> {
  const user = await requireUser();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return { error: "المشروع غير موجود." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "اختر ملفًا للرفع." };
  }

  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer.slice(0, 8));
  const check = validateUploadedFile(
    file.name,
    file.type,
    file.size,
    head,
    serverEnv.maxProjectFileSize,
  );
  if (!check.ok) return { error: check.error };

  const storageKey = buildStorageKey(projectId, file.name);

  const upload = await uploadToStorage(storageKey, buffer, check.matchedMime!);
  if (upload.error) {
    return { error: `تعذّر رفع الملف: ${upload.error.message}` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const record = await tx.projectFile.create({
        data: {
          projectId,
          fileName: file.name.replace(/^.*[\\/]/, ""),
          storageKey,
          fileType: check.matchedMime!,
          fileSize: file.size,
          uploadedBy: user.id,
        },
      });
      await writeAuditLog(
        {
          userId: user.id,
          action: "file_uploaded",
          entity: "project_file",
          entityId: record.id,
          newValue: {
            projectId,
            fileName: record.fileName,
            fileSize: record.fileSize,
          },
        },
        tx,
      );
    });
  } catch (e) {
    // DB write failed after the object landed in Storage — remove the
    // orphan so Storage and the DB stay consistent.
    await removeFromStorage(storageKey).catch(() => {});
    return {
      error: `تعذّر حفظ بيانات الملف: ${e instanceof Error ? e.message : "خطأ غير معروف"}`,
    };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: "تم رفع الملف." };
}

export async function deleteProjectFileAction(
  fileId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const record = await prisma.projectFile.findUnique({ where: { id: fileId } });
  if (!record) return { error: "الملف غير موجود." };

  // Delete from Storage first. If that fails, keep the DB record so we
  // never end up with a row pointing at a missing object.
  const removed = await removeFromStorage(record.storageKey);
  if (removed.error) {
    return { error: `تعذّر حذف الملف من التخزين: ${removed.error.message}` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectFile.delete({ where: { id: fileId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "file_deleted",
        entity: "project_file",
        entityId: fileId,
        oldValue: {
          projectId: record.projectId,
          fileName: record.fileName,
          fileSize: record.fileSize,
        },
      },
      tx,
    );
  });

  revalidatePath(`/projects/${record.projectId}`);
  return {};
}
