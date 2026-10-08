# 404 Legends — Internal Management System

نظام إدارة داخلي لشركة **404 Legends** لإدارة العملاء، المشاريع، المدفوعات،
المصروفات، الأرباح، وملفات المشاريع (PDF). أداة داخلية — ليست SaaS عامة.

> Where 404 Becomes Legend

## Stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS v4
- PostgreSQL via Supabase
- Prisma (database access layer)
- Supabase Auth (email + password, no public sign-up)
- Supabase Storage (private bucket) for PDF files
- Recharts for charts

الواجهة عربية بالكامل مع اتجاه RTL، و Dark theme افتراضي.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real Supabase values
npm run prisma:generate
npm run dev
```

يفتح على http://localhost:3000

## Project structure

```
src/
  app/            # صفحات ومسارات (App Router)
    login/        # شاشة الدخول
  components/
    ui/           # عناصر واجهة أساسية (Button, Input, Card, ...)
  lib/
    env.ts        # وصول مُنظّم لمتغيرات البيئة
    cn.ts         # مساعد classNames
    supabase/     # عملاء Supabase (browser / server / admin)
    db/           # طبقة الوصول لقاعدة البيانات (Prisma)
    services/     # منطق الأعمال (حسابات مالية، تحقق) — بدون إطار
  server/         # Server Actions / API — الطبقة الوحيدة التي تتحقق من الجلسة
prisma/
  schema.prisma   # مخطط قاعدة البيانات
  seed.ts         # بيانات مرجعية
```

## Roadmap

منجز: Clients، Projects، Files، Payments/Expenses، Audit Logs، Dashboard، Reports،
Calendar/Meetings، Export، Employees/Payroll/Company account، بوابة الموظف،
Target clients، Announcements، Tasks (أولوية + drag-and-drop + ترحيل تلقائي).

قادم: Invoices/Quotations/Contracts، Client Portal، WhatsApp/Email notifications.

## Security notes

- تسجيل الحسابات الذاتي في Supabase **لازم يكون مقفول** (Authentication → Sign In / Providers → Disable signups).
- الأدوار تتحدد من `app_metadata` (service-role فقط) — الافتراضي `employee`. التطبيق يتعامل مع البيانات عبر Prisma فقط؛ مفيش سياسات RLS للـ `authenticated`.

## Tests

```bash
npm test
```
