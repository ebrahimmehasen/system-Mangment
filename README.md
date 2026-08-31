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

Phase 1 (الحالي): Setup, Schema, Auth, Clients, Projects, Files, Payments/Expenses,
Audit Logs, Dashboard, Reports.

Phases 2–7: Calendar/Meetings، تقارير متقدمة + Export، Employees/Roles/Salaries،
Invoices/Quotations/Contracts، Client Portal، WhatsApp/Email notifications.
