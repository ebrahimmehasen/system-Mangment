export interface NavItem {
  href: string;
  label: string;
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/clients", label: "العملاء" },
  { href: "/projects", label: "المشاريع" },
  { href: "/employees", label: "الموظفون" },
  { href: "/target-clients", label: "العملاء المستهدفون" },
  { href: "/calendar", label: "التقويم" },
  { href: "/meetings", label: "الاجتماعات" },
  { href: "/reminders", label: "التذكيرات" },
  { href: "/notifications", label: "التنبيهات" },
  { href: "/payments", label: "المدفوعات" },
  { href: "/expenses", label: "المصروفات" },
  { href: "/company-account", label: "حساب الشركة" },
  { href: "/reports", label: "التقارير" },
  { href: "/audit-logs", label: "سجل التدقيق" },
  { href: "/team", label: "المشرفون" },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
