# المرحلة 4 — الموظفين، الرواتب/العمولات، حساب الشركة، والتقارير

> ملف بلان تنفيذي لـ Claude Code. مبني على فحص فعلي للكود الحالي (Next.js 16 + Prisma 6 + Supabase + PostgreSQL،
> نمط الليدجر المركزي `Transaction` مع `Payment`/`Expense` كـ typed views عليه، وطبقة `src/lib/services/*` +
> `src/server/*-actions.ts` + صفحات `src/app/(app)/*`). كل مهمة فيها المسارات المتوقعة عشان الشغل يبقى متسق مع
> باقي المشروع، مش حاجة منفصلة.

---

## 0. السياق الحالي (اللي موجود بالفعل ومتأكد منه بالفحص)

- **مفيش موديل Employee خالص** — فيه بس `User` (الأدمن/المشرفين اللي بيدخلوا يستخدموا السيستم، صفحة `/team`).
- **الليدجر المركزي**: كل حركة فلوس = صف في `Transaction` (type: income/expense/discount/refund/adjustment، فيه `amountOriginal` + `currency` + `exchangeRateToEgp` + `amountEgp` مجمّد وقت الإدخال). `Payment` و `Expense` كل واحد فيه `transactionId` فريد (1:1) وبيمثلوا نوع خاص من الحركة. **هنمشي بنفس النمط ده للموظفين وحساب الشركة** بدل ما نخترع نظام تاني.
- **`Expense`** فيها `ExpenseType` (`project` / `company`) بالفعل — يعني فكرة "مصروف على الشركة نفسها" مش جديدة، بس لسه مفيش "محفظة/حساب شركة" له رصيد متراكم يتعرض في صفحة مستقلة.
- **رفع ملفات**: نمط جاهز وشغال في `ProjectFile` + `src/lib/storage.ts` + `src/server/file-actions.ts` + bucket خاص (`project-files`, private, signed URLs, PDF فقط 10MB) اتعمل بميجريشن `20260901120000_storage_bucket`. هنستخدم نفس النمط بالظبط لملف الـ CV.
- **التقارير**: `src/lib/reports/{data,advanced,operational,tables,charts,presets}.ts` + `src/app/(app)/reports/center` فيها بالفعل نوع تقرير اسمه **"التقرير المالي للعملاء"**، وفيه حسابات `remaining = final - paid` جاهزة لكل مشروع (`src/lib/services/projects.ts`, `src/lib/reports/advanced.ts`). يعني تقرير "العميل: عنده كام مشروع، حالتهم، استلمنا كام، باقي كام" **جزء كبير منه موجود فعلاً** — المطلوب تأكيد إنه بيدعم اختيار عميل واحد وتصدير PDF له، مش بناء من الصفر.
- **تصدير PDF**: `src/lib/export/pdf.tsx` (`@react-pdf/renderer`) + خطوط عربي (`Amiri-Regular/Bold`) جاهزة فعلاً — يبقى تقرير الموظف/المشروع الجديد هيستخدم نفس الأدوات.
- **تصدير Excel**: `src/lib/export/excel.ts` (`exceljs`) جاهز — هيتستخدم لشيت الموظفين.
- **التقويم**: صفحة `/calendar` **فيها بالفعل** خاصية إن الضغط على يوم بيفتح قائمة بكل اللي فيه (اجتماعات/مراحل/تذكيرات/تسليمات) — `src/app/(app)/calendar/page.tsx` سطر ~204. **مطلوب تأكيد بس (QA)، مش تطوير من جديد.**
- **التذكيرات**: `Reminder` عنده `createdBy` في قاعدة البيانات، لكن صفحة `/reminders` (`src/app/(app)/reminders/page.tsx`) **لسه مش بتجيب ولا بتعرض اسم منشئ التذكير**. ده تعديل صغير حقيقي مطلوب.

---

## 1. قرارات لازم تتاخد قبل الكود (افتراضاتي موجودة، لو مش مناسبة قولّي أغيرها)

1. **الموظف مش عنده تسجيل دخول** — هو سجل بيانات (Employee record) بيديره الأدمن، مش `User`. المشرفين (Supervisors) هم `User` الموجودين فعلاً. لو المفروض الموظف نفسه يدخل يشوف بروفايله، ده هيحتاج نقاش منفصل لاحقًا.
2. **العمولة/الراتب**: افتراضي إنه ممكن يتحسب كـ:
   - مبلغ ثابت (Fixed) — يتضاف يدويًا.
   - عمولة (Commission) — نسبة % أو مبلغ مقطوع مرتبط بمشروع معيّن.
   - خصم (Deduction) — يقلل من مستحقات الموظف (مش من حساب الشركة).
3. **مصدر صرف فلوس الموظف**: إما (أ) من **حساب الشركة** (رصيد مُجنّب) أو (ب) من **ميزانية المشروع** نفسه (بيتخصم من قيمة العقد/الأرباح المرتبطة بالمشروع ده). هيبقى فيه اختيار `source` وقت الدفع.
4. **حساب الشركة**: افتراضي إنه "محفظة داخلية" بترصيدها بإيداعات يدوية (تسجّل إنك بتنقل مبلغ من الفلوس العامة/مستحقات لجنب) وسحوبات يدوية (تصرف منها على الشركة أو تدفع موظف). مش هيعمل خصم تلقائي من حساب عميل معيّن — لو المقصود حاجة تانية (مثلاً نسبة تلقائية من كل دفعة عميل)، محتاج توضيح.
5. **تقييم الموظف (1-10)**: رقم واحد بيتحدث يدويًا من الأدمن في صفحة بروفايل الموظف (مش متوسط تقييمات متعددة)، إلا لو عايز سجل تقييمات بالتاريخ.

---

## 2. تعديلات قاعدة البيانات (`prisma/schema.prisma` + migration جديدة)

### 2.1 موديل `Employee`

```prisma
enum EmployeeStatus {
  active
  inactive
}

model Employee {
  id            String         @id @default(uuid()) @db.Uuid
  name          String
  age           Int?
  country       String?
  governorate   String?        @map("governorate")
  phone         String?
  qualification String?
  cvStorageKey  String?        @map("cv_storage_key")
  cvFileName    String?        @map("cv_file_name")
  rating        Int?           @default(0) // 1..10, يتراجع في التطبيق مش في الداتابيز
  status        EmployeeStatus @default(active)
  notes         String?
  createdBy     String?        @map("created_by") @db.Uuid
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  creator     User?              @relation("EmployeeCreatedBy", fields: [createdBy], references: [id], onDelete: SetNull)
  assignments ProjectAssignment[]
  payments    EmployeePayment[]

  @@index([status])
  @@map("employees")
}
```

### 2.2 موديل `ProjectAssignment` (ربط موظف أو مشرف بمشروع)

```prisma
enum AssignmentRole {
  employee
  supervisor
}

model ProjectAssignment {
  id         String         @id @default(uuid()) @db.Uuid
  projectId  String         @map("project_id") @db.Uuid
  employeeId String?        @map("employee_id") @db.Uuid // لو الدور employee
  userId     String?        @map("user_id") @db.Uuid     // لو الدور supervisor
  role       AssignmentRole
  assignedAt DateTime       @default(now()) @map("assigned_at")
  createdBy  String?        @map("created_by") @db.Uuid

  project  Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  employee Employee? @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  user     User?     @relation("AssignmentUser", fields: [userId], references: [id], onDelete: Cascade)
  creator  User?     @relation("AssignmentCreatedBy", fields: [createdBy], references: [id], onDelete: SetNull)

  @@unique([projectId, employeeId])
  @@unique([projectId, userId])
  @@index([projectId])
  @@map("project_assignments")
}
```

قيد على مستوى التطبيق (مش هيتعمل CHECK في الداتابيز عشان بساطة): لازم يبقى فيه `employeeId` أو `userId` واحد بس مش الاتنين مع بعض، وده حسب `role`.

### 2.3 موديل `EmployeePayment` (راتب/عمولة/خصم — نفس نمط `Payment`/`Expense`)

```prisma
enum EmployeePayType {
  commission
  fixed
  bonus
  deduction
}

enum EmployeePaySource {
  company_account
  project_budget
}

model EmployeePayment {
  id                String            @id @default(uuid()) @db.Uuid
  employeeId        String            @map("employee_id") @db.Uuid
  projectId         String?           @map("project_id") @db.Uuid
  transactionId     String            @unique @map("transaction_id") @db.Uuid
  payType           EmployeePayType   @map("pay_type")
  source            EmployeePaySource
  amountOriginal    Decimal           @map("amount_original") @db.Decimal(14, 2)
  currency          Currency
  exchangeRateToEgp Decimal           @map("exchange_rate_to_egp") @db.Decimal(18, 6)
  amountEgp         Decimal           @map("amount_egp") @db.Decimal(14, 2)
  date              DateTime          @db.Date
  notes             String?
  createdBy         String?           @map("created_by") @db.Uuid
  createdAt         DateTime          @default(now()) @map("created_at")

  employee    Employee    @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  project     Project?    @relation(fields: [projectId], references: [id], onDelete: SetNull)
  transaction Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  creator     User?       @relation("EmployeePaymentCreatedBy", fields: [createdBy], references: [id], onDelete: SetNull)

  @@index([employeeId])
  @@index([projectId])
  @@map("employee_payments")
}
```

- لو `source = company_account` → لازم يتعمل معاها صف `CompanyAccountEntry(type: withdrawal)` بنفس الـ transaction.
- لو `source = project_budget` → يتعمل `Expense(type: project, projectId, ...)` مرتبط بنفس الـ transaction (زي أي مصروف مشروع عادي).

### 2.4 موديل `CompanyAccountEntry` (حساب الشركة)

```prisma
enum CompanyAccountDirection {
  deposit
  withdrawal
}

model CompanyAccountEntry {
  id                String                   @id @default(uuid()) @db.Uuid
  direction         CompanyAccountDirection
  transactionId     String                   @unique @map("transaction_id") @db.Uuid
  amountOriginal    Decimal                  @map("amount_original") @db.Decimal(14, 2)
  currency          Currency
  exchangeRateToEgp Decimal                  @map("exchange_rate_to_egp") @db.Decimal(18, 6)
  amountEgp         Decimal                  @map("amount_egp") @db.Decimal(14, 2)
  date              DateTime                 @db.Date
  reason            String?
  createdBy         String?                  @map("created_by") @db.Uuid
  createdAt         DateTime                 @default(now()) @map("created_at")

  transaction Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  creator     User?       @relation("CompanyAccountCreatedBy", fields: [createdBy], references: [id], onDelete: SetNull)

  @@index([direction])
  @@index([date])
  @@map("company_account_entries")
}
```

الرصيد الحالي = `sum(deposit.amountEgp) - sum(withdrawal.amountEgp)` (والسحوبات بتشمل صرف على الشركة + أي `EmployeePayment` مصدره `company_account`).

### 2.5 تعديلات لازمة على موديلات موجودة

- `User`: إضافة العلاقات العكسية (`employeesCreated`, `assignmentsAsSupervisor`, `employeePaymentsCreated`, `companyAccountEntriesCreated`, ...).
- `Project`: إضافة `assignments ProjectAssignment[]` و `employeePayments EmployeePayment[]`.
- `Transaction`: إضافة `employeePayment EmployeePayment?` و `companyAccountEntry CompanyAccountEntry?` (زي `payment`/`expense` بالظبط).

### 2.6 Migration + Storage bucket جديد

- Migration جديدة (زي أسلوب الملفات الموجودة تحت `prisma/migrations/`، بنفس التسمية بالتاريخ) تضيف الجداول فوق + RLS policies بنفس نمط `20260901073500_rls_policies`.
- Bucket تخزين جديد للـ CV، على نمط `20260901120000_storage_bucket`:
  ```sql
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('employee-cvs', 'employee-cvs', false, 10485760,
          ARRAY['application/pdf', 'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
  ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  ```

---

## 3. طبقة الـ Services والـ Server Actions (بنفس تقسيم المشروع الحالي)

| الملف الجديد | الغرض | على غرار |
|---|---|---|
| `src/lib/services/employees.ts` | queries: قائمة الموظفين، بروفايل موظف + مشاريعه + مدفوعاته | `src/lib/services/clients.ts` |
| `src/server/employee-actions.ts` | `createEmployee`, `updateEmployee`, `setEmployeeRating`, `uploadEmployeeCv`, `deleteEmployeeCv`, `archiveEmployee` | `src/server/project-actions.ts` + `src/server/file-actions.ts` |
| `src/server/assignment-actions.ts` | `assignToProject` (employee أو supervisor), `removeFromProject` | — |
| `src/lib/services/payroll.ts` | حساب مستحقات/مدفوعات كل موظف، تجميعها لكل مشروع | `src/lib/services/transactions.ts` |
| `src/server/payroll-actions.ts` | `payEmployee` (بيعمل Transaction + EmployeePayment + إما CompanyAccountEntry أو Expense حسب `source`) | `src/server/*-actions.ts` |
| `src/lib/services/company-account.ts` | حساب الرصيد الحالي + سجل الحركات | `src/lib/services/transactions.ts` |
| `src/server/company-account-actions.ts` | `depositToCompanyAccount`, `withdrawFromCompanyAccount` | — |

---

## 4. الصفحات والمكوّنات (UI)

### 4.1 `/employees` (قائمة الموظفين)
- جدول: الاسم، الوظيفة/المؤهل، الدولة، المحافظة، الهاتف، التقييم، الحالة.
- زرار "إضافة موظف" (Modal بنفس نمط `MeetingFormModal`/`ReminderFormModal`) بكل الحقول المطلوبة + رفع CV.
- زرار "تصدير Excel" أعلى الصفحة (`src/lib/export/excel.ts`) — شيت فيه كل الموظفين وبياناتهم.
- الضغط على صف الموظف → `/employees/[id]`.

### 4.2 `/employees/[id]` (بروفايل الموظف)
- بيانات الموظف + رابط تحميل CV (signed URL زي ملفات المشروع).
- تقييم 1-10 (input رقم أو نجوم) قابل للتعديل مباشرة.
- قائمة المشاريع المعيّن عليها (من `ProjectAssignment`) بدوره (موظف/مشرف).
- سجل المدفوعات (كوموشن/راتب/خصم) + زرار "إضافة دفعة" (Modal يختار: النوع، المصدر (حساب الشركة/ميزانية مشروع)، المبلغ، مشروع مرتبط لو عمولة).
- زرار "تصدير تقرير PDF" لهذا الموظف (تفصيل لكل مشروع: استلم كام، اتخصم منه كام) — **مربوط بالتمبلت اللي هيتبعت لاحقًا** (بند 6).

### 4.3 صفحة تفاصيل المشروع — قسم "الفريق"
- إضافة تبويب/قسم جديد في `src/app/(app)/projects/[id]/page.tsx` لعرض المعيّنين (موظفين + مشرفين) مع إمكانية إضافة/إزالة.

### 4.4 `/company-account` (حساب الشركة)
- كارت الرصيد الحالي (بالجنيه، ومفصّل لو فيه عملات تانية).
- جدول حركات (إيداع/سحب) بالتاريخ والسبب ومين سجّلها.
- زرار "إيداع" وزرار "سحب" (Modal بسيط: مبلغ، عملة، تاريخ، سبب).

### 4.5 التذكيرات — إضافة اسم المنشئ
- في `src/app/(app)/reminders/page.tsx`: إضافة `creator: { select: { name: true } }` في الـ `select`، وعرض الاسم كـ Badge بجانب كل تذكير.

### 4.6 التقويم — تأكيد فقط (لا تطوير)
- مراجعة `src/app/(app)/calendar/page.tsx` (قسم `selectedDay` القائم بالفعل) والتأكد إنه شغال كويس مع كل الأنواع (اجتماع/مرحلة/تذكير/تسليم). لو ناقصه حاجة بسيطة (مثلاً عرض اسم منشئ التذكير هنا كمان) تتضاف.

---

## 5. التقارير الجديدة/الموسّعة

1. **شيت الموظفين (Excel)** — جديد بالكامل، `src/lib/export/excel.ts` + route تصدير مشابه لـ `src/app/api/export/reports/route.ts`.
2. **صفحة/كارت "اسم + وظيفة" عند الضغط على موظف** — ده أصلاً هو `/employees/[id]`، غالبًا مش محتاج شغل إضافي غير التأكد إن أول حاجة ظاهرة فوق هي الاسم والمسمى الوظيفي بشكل واضح.
3. **تقرير موظف + مشروع (PDF)** — يستخدم `EmployeePayment` مجمّعة حسب `projectId`: كام استلم، كام اتخصم، الصافي. **معلّق لحد ما يوصل التمبلت** من المستخدم — لما يوصل، نطابق الحقول ونضيف `generateEmployeeProjectPdf` في `src/lib/export/pdf.tsx`.
4. **تقرير عميل (مشاريعه/حالتهم/المستلم/الباقي)** — مراجعة تقرير "التقرير المالي للعملاء" الموجود في `reports/center`:
   - تأكيد دعم اختيار **عميل واحد بعينه** كفلتر.
   - تأكيد ظهور: عدد المشاريع، حالة كل مشروع، الإجمالي المستلم، الإجمالي المتبقي.
   - لو ناقص أي بند من دول يتضاف على `src/lib/reports/advanced.ts` / `operational.ts` مش يتعمل تقرير منفصل من الصفر.

---

## 6. حاجة لسه محتاجة منك (مش من كلود كود)

- **تمبلت الـ PDF** لتقرير الموظف/المشروع (هتبعته لاحقًا) — لما يوصل، كلود كود يطابق التصميم والحقول عليه.
- تأكيد على القرارات المفترضة في قسم 1، خصوصًا: هل الموظف ممكن يبقى نفس حد مسجل كـ `User` لاحقًا؟ وهل حساب الشركة بيتغذى بس يدويًا ولا فيه نسبة تلقائية من كل دفعة عميل؟

---

## 7. ترتيب تنفيذ مقترح (Sprint order)

1. Prisma schema + migration (قسم 2) + تشغيل `prisma migrate dev` + تحديث `prisma/seed.ts` لو محتاج بيانات تجريبية.
2. Employees CRUD + رفع CV + صفحة القائمة والبروفايل (بدون تقييم/مدفوعات لسه).
3. التقييم (1-10) على بروفايل الموظف.
4. `ProjectAssignment` (تعيين موظفين/مشرفين على مشروع) + قسم "الفريق" في صفحة المشروع.
5. حساب الشركة (`CompanyAccountEntry` + صفحة `/company-account`).
6. `EmployeePayment` (الرواتب/العمولات/الخصومات) — مربوط بحساب الشركة أو ميزانية المشروع.
7. شيت الموظفين Excel.
8. مراجعة/توسيع تقرير العملاء الموجود.
9. تعديل صفحة التذكيرات لعرض اسم المنشئ.
10. QA لخاصية الضغط على يوم في التقويم (موجودة بالفعل).
11. لما يوصل تمبلت الـ PDF: تقرير الموظف/المشروع.

