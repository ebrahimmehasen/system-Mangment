"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { serverEnv } from "@/lib/env";
import {
  EMPLOYEE_CVS_BUCKET,
  buildCvStorageKey,
  removeFromStorage,
  uploadToStorage,
  validateCvFile,
} from "@/lib/storage";
import {
  parseEmployeeForm,
  toEmployeeData,
  type EmployeeFormValues,
} from "@/lib/services/employees";

export interface EmployeeActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

function snapshot(e: {
  name: string;
  age: number | null;
  country: string | null;
  governorate: string | null;
  phone: string | null;
  qualification: string | null;
  status: string;
  cvFileName: string | null;
}) {
  return {
    name: e.name,
    age: e.age,
    country: e.country,
    governorate: e.governorate,
    phone: e.phone,
    qualification: e.qualification,
    status: e.status,
    cvFileName: e.cvFileName,
  };
}

type CvUpload =
  | { ok: true; key: string; fileName: string }
  | { ok: false; error: string };

/**
 * Validate + upload a CV file if one was attached. Returns the storage key +
 * file name to persist, an error, or `null` when no file was attached.
 */
async function handleCvUpload(
  formData: FormData,
  employeeId: string,
): Promise<CvUpload | null> {
  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) return null;

  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer.slice(0, 8));
  const check = validateCvFile(
    file.name,
    file.type,
    file.size,
    head,
    serverEnv.maxProjectFileSize,
  );
  if (!check.ok) return { ok: false, error: check.error! };

  const key = buildCvStorageKey(employeeId, file.name);
  const upload = await uploadToStorage(
    key,
    buffer,
    check.matchedMime!,
    EMPLOYEE_CVS_BUCKET,
  );
  if (upload.error) {
    return { ok: false, error: `تعذّر رفع السيرة الذاتية: ${upload.error.message}` };
  }

  return { ok: true, key, fileName: file.name.replace(/^.*[\\/]/, "") };
}

function backWithErrors(
  errors: Partial<Record<keyof EmployeeFormValues, string>>,
  values: EmployeeFormValues,
): EmployeeActionState {
  return {
    fieldErrors: errors as Record<string, string>,
    values: values as unknown as Record<string, string>,
  };
}

export async function createEmployeeAction(
  _prev: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseEmployeeForm(formData);
  if (Object.keys(errors).length > 0) return backWithErrors(errors, values);

  const id = crypto.randomUUID();
  const cv = await handleCvUpload(formData, id);
  if (cv && !cv.ok) {
    return { error: cv.error, values: values as unknown as Record<string, string> };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          id,
          ...toEmployeeData(values, parsed.age),
          cvStorageKey: cv?.key ?? null,
          cvFileName: cv?.fileName ?? null,
          createdBy: user.id,
        },
      });
      await writeAuditLog(
        {
          userId: user.id,
          action: "created",
          entity: "employee",
          entityId: employee.id,
          newValue: snapshot(employee),
        },
        tx,
      );
    });
  } catch (e) {
    if (cv?.ok) await removeFromStorage(cv.key, EMPLOYEE_CVS_BUCKET).catch(() => {});
    return {
      error: `تعذّر حفظ الموظف: ${e instanceof Error ? e.message : "خطأ غير معروف"}`,
    };
  }

  revalidatePath("/employees");
  redirect(`/employees/${id}`);
}

export async function updateEmployeeAction(
  employeeId: string,
  _prev: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseEmployeeForm(formData);
  if (Object.keys(errors).length > 0) return backWithErrors(errors, values);

  const existing = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!existing) return { error: "الموظف غير موجود." };

  const cv = await handleCvUpload(formData, employeeId);
  if (cv && !cv.ok) {
    return { error: cv.error, values: values as unknown as Record<string, string> };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: {
          ...toEmployeeData(values, parsed.age),
          ...(cv?.ok ? { cvStorageKey: cv.key, cvFileName: cv.fileName } : {}),
        },
      });
      await writeAuditLog(
        {
          userId: user.id,
          action: "updated",
          entity: "employee",
          entityId: employeeId,
          oldValue: snapshot(existing),
          newValue: snapshot(updated),
        },
        tx,
      );
    });
  } catch (e) {
    if (cv?.ok) await removeFromStorage(cv.key, EMPLOYEE_CVS_BUCKET).catch(() => {});
    return {
      error: `تعذّر تحديث الموظف: ${e instanceof Error ? e.message : "خطأ غير معروف"}`,
    };
  }

  // Replace succeeded — drop the previous CV object.
  if (cv?.ok && existing.cvStorageKey && existing.cvStorageKey !== cv.key) {
    await removeFromStorage(existing.cvStorageKey, EMPLOYEE_CVS_BUCKET).catch(() => {});
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  redirect(`/employees/${employeeId}`);
}

export interface CvActionState {
  error?: string;
  success?: string;
}

export async function uploadEmployeeCvAction(
  employeeId: string,
  _prev: CvActionState,
  formData: FormData,
): Promise<CvActionState> {
  const user = await requireUser();

  const existing = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!existing) return { error: "الموظف غير موجود." };

  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "اختر ملفًا للرفع." };
  }

  const cv = await handleCvUpload(formData, employeeId);
  if (!cv) return { error: "اختر ملفًا للرفع." };
  if (!cv.ok) return { error: cv.error };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: { cvStorageKey: cv.key, cvFileName: cv.fileName },
      });
      await writeAuditLog(
        {
          userId: user.id,
          action: "file_uploaded",
          entity: "employee_cv",
          entityId: employeeId,
          newValue: { fileName: cv.fileName },
        },
        tx,
      );
    });
  } catch (e) {
    await removeFromStorage(cv.key, EMPLOYEE_CVS_BUCKET).catch(() => {});
    return { error: e instanceof Error ? e.message : "خطأ غير معروف" };
  }

  if (existing.cvStorageKey && existing.cvStorageKey !== cv.key) {
    await removeFromStorage(existing.cvStorageKey, EMPLOYEE_CVS_BUCKET).catch(() => {});
  }

  revalidatePath(`/employees/${employeeId}`);
  return { success: "تم رفع السيرة الذاتية." };
}

export async function deleteEmployeeCvAction(
  employeeId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { error: "الموظف غير موجود." };
  if (!employee.cvStorageKey) return {};

  const removed = await removeFromStorage(employee.cvStorageKey, EMPLOYEE_CVS_BUCKET);
  if (removed.error) {
    return { error: `تعذّر حذف الملف من التخزين: ${removed.error.message}` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: { cvStorageKey: null, cvFileName: null },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "file_deleted",
        entity: "employee_cv",
        entityId: employeeId,
        oldValue: { fileName: employee.cvFileName },
      },
      tx,
    );
  });

  revalidatePath(`/employees/${employeeId}`);
  return {};
}

export async function deleteEmployeeAction(
  employeeId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { _count: { select: { payments: true } } },
  });
  if (!employee) return { error: "الموظف غير موجود." };

  if (employee._count.payments > 0) {
    return {
      error: `لا يمكن حذف الموظف لوجود ${employee._count.payments} حركة مالية مرتبطة به. أرشِفه بدلًا من حذفه.`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employee.delete({ where: { id: employeeId } });
      await writeAuditLog(
        {
          userId: user.id,
          action: "deleted",
          entity: "employee",
          entityId: employeeId,
          oldValue: snapshot(employee),
        },
        tx,
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { error: "لا يمكن حذف الموظف لوجود سجلات مرتبطة به." };
    }
    throw e;
  }

  if (employee.cvStorageKey) {
    await removeFromStorage(employee.cvStorageKey, EMPLOYEE_CVS_BUCKET).catch(() => {});
  }

  revalidatePath("/employees");
  redirect("/employees");
}

/**
 * Set an employee's manual rating. 1–10, or 0 to clear it (unrated).
 */
export async function setEmployeeRatingAction(
  employeeId: string,
  rating: number,
): Promise<{ error?: string }> {
  const user = await requireUser();

  if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
    return { error: "التقييم يجب أن يكون رقمًا من 0 إلى 10." };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { rating: true },
  });
  if (!employee) return { error: "الموظف غير موجود." };
  if ((employee.rating ?? 0) === rating) return {};

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: { rating },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "employee",
        entityId: employeeId,
        oldValue: { rating: employee.rating ?? 0 },
        newValue: { rating },
      },
      tx,
    );
  });

  revalidatePath(`/employees/${employeeId}`);
  return {};
}
