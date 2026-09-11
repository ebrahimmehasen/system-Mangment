/** Human-readable Arabic labels for audit log actions and entities. */

export const AUDIT_ACTIONS: Record<string, string> = {
  created: "إنشاء",
  updated: "تعديل",
  deleted: "حذف",
  status_changed: "تغيير الحالة",
  file_uploaded: "رفع ملف",
  file_deleted: "حذف ملف",
  payment_created: "تسجيل دفعة",
  expense_created: "تسجيل مصروف",
  expense_deleted: "حذف مصروف",
};

export const AUDIT_ENTITIES: Record<string, string> = {
  client: "عميل",
  project: "مشروع",
  project_file: "ملف مشروع",
  payment: "دفعة",
  expense: "مصروف",
  meeting: "اجتماع",
  milestone: "مرحلة",
  reminder: "تذكير",
  employee: "موظف",
  employee_cv: "سيرة ذاتية",
  project_assignment: "تعيين على مشروع",
  company_account: "حساب الشركة",
  employee_payment: "دفعة موظف",
  employee_login: "حساب دخول موظف",
  admin_password: "كلمة مرور مشرف",
  target_client: "عميل مستهدف",
  target_client_activity: "نشاط عميل مستهدف",
  announcement: "إعلان",
};

export const actionLabel = (a: string) => AUDIT_ACTIONS[a] ?? a;
export const entityLabel = (e: string) => AUDIT_ENTITIES[e] ?? e;
