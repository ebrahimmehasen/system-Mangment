"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
  /** echoed back so the form can repopulate after a failed submit */
  values?: Record<string, string>;
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "أدخل البريد الإلكتروني وكلمة المرور.", values: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "بيانات الدخول غير صحيحة.", values: { email } };
  }

  redirect("/dashboard");
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireUser();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) {
    return { error: "أدخل كلمة المرور الحالية والجديدة." };
  }
  if (newPassword.length < 8) {
    return { error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "كلمة المرور الجديدة وتأكيدها غير متطابقين." };
  }
  if (newPassword === currentPassword) {
    return { error: "كلمة المرور الجديدة مطابقة للحالية." };
  }

  const supabase = await createClient();

  // Verify the current password before allowing the change.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: me.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: "كلمة المرور الحالية غير صحيحة." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { error: `تعذّر تغيير كلمة المرور: ${error.message}` };
  }

  return { success: "تم تغيير كلمة المرور بنجاح." };
}

export interface ResetPasswordState {
  error?: string;
  success?: string;
}

/**
 * Admin-privileged password reset for *someone else's* account — no current
 * password required (unlike changePasswordAction, which is self-service).
 * Permission rule (Phase 5 matrix): any admin may reset an employee's
 * password; only the super admin may reset another admin's password.
 */
export async function resetUserPasswordAction(
  targetUserId: string,
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const actingUser = await requireUser();

  if (targetUserId === actingUser.id) {
    return { error: 'استخدم نموذج "تغيير كلمة المرور" لتغيير كلمة مرورك أنت.' };
  }

  // Only an admin may reset someone ELSE's password at all — an employee
  // can never do this, not even for another employee (matrix: "تغيير باسورد
  // موظف: ✅ أي أدمن ❌ موظف"). The admin-vs-admin super-admin check below
  // narrows it further once we know the caller is at least an admin.
  if (actingUser.role !== "admin") {
    return { error: "غير مصرّح لك بتغيير كلمة مرور مستخدم تاني." };
  }

  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (newPassword.length < 8) {
    return { error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "كلمة المرور الجديدة وتأكيدها غير متطابقين." };
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) return { error: "المستخدم غير موجود." };

  if (target.role === "admin" && !actingUser.isSuperAdmin) {
    return { error: "فقط السوبر أدمن يقدر يغيّر كلمة مرور مشرف تاني." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  });
  if (error) {
    return { error: `تعذّر تغيير كلمة المرور: ${error.message}` };
  }

  await writeAuditLog({
    userId: actingUser.id,
    action: "updated",
    entity: target.role === "admin" ? "admin_password" : "employee_login",
    entityId: targetUserId,
  });

  return { success: `تم تغيير كلمة مرور ${target.name ?? target.email}.` };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createAdminAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Only an existing signed-in admin may add another admin.
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "الاسم مطلوب." };
  if (!EMAIL_RE.test(email)) return { error: "صيغة البريد الإلكتروني غير صحيحة." };
  if (password.length < 8) {
    return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "يوجد مستخدم بهذا البريد بالفعل." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "admin" },
  });

  if (error || !data.user) {
    return { error: `تعذّر إنشاء المستخدم: ${error?.message ?? "خطأ غير معروف"}` };
  }

  // The auth trigger mirrors into public.users; ensure name is set.
  await prisma.user.upsert({
    where: { id: data.user.id },
    update: { name, role: "admin" },
    create: { id: data.user.id, email, name, role: "admin" },
  });

  revalidatePath("/team");
  return { success: `تم إنشاء المشرف ${name}.` };
}
