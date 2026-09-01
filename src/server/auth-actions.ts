"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "أدخل البريد الإلكتروني وكلمة المرور." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "بيانات الدخول غير صحيحة." };
  }

  redirect("/dashboard");
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
  await requireUser();

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
