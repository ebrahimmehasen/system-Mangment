# المرحلة 5 — العملاء المستهدفون (الليدز) + بوابة دخول للموظفين + الإعلانات

> بلان تنفيذي لـ Claude Code، مبني على فحص فعلي لحالة الكود دلوقتي (بعد ما اتنفذت المرحلة 4: `Employee`,
> `ProjectAssignment`, `EmployeePayment`, `CompanyAccountEntry` موجودين فعلاً في `prisma/schema.prisma`).
> فيه تغيير مهم عن قرار المرحلة اللي فاتت: تعليق السكيما بيقول "Employees are admin-managed records (no
> login...)" — ده هيتغيّر دلوقتي لأن المطلوب الجديد إن الموظف يبقى له تسجيل دخول فعلي.

---

## قرارات نهائية (2026-09-11 — بديلة عن قسم 9 أدناه)

1. يوزرنيم الموظف → إيميل داخلي مُولّد (`firstname@404legends.local`).
2. **Google Drive/الفويس كول مؤجّلة** — مش هتتبني الآن (لا Service Account ولا زرار تسجيل ولا API route).
   لكن السكيما بتتجهّز من الأول عشان ميحصلش migration تاني بعدين: عمود `TargetClientActivityKind.voice_call`
   وأعمدة `driveFileId` / `driveWebLink` / `durationSeconds` بتتحط في `TargetClientActivity` من نفس
   الميجريشن الأولى، وبس. قسم 3 كامل (تكامل Drive) وخطوة 5 من ترتيب التنفيذ (قسم 8) مؤجّلين لحد ما يُطلب
   تنفيذهم صراحة.
3. سوبر أدمن → `isSuperAdmin = true` لـ `ebrahimmehasen108@gmail.com` (Ebrahim Mehasen)، من الميجريشن/seed
   بس، مفيش UI.
4. **فشل الديل — تغيير عن الافتراضي في قسم 1:** العميل المستهدف **ميرجعش متاح تلقائيًا**. بدل كده: يفضل
   معيّن على نفس الموظف اللي فشل فيه (`claimedById` زي ما هو، `status: lost`)، ويظهر عليه Badge/علامة واضحة
   إنه "فشل" مع الموظف ده (زي تاريخ محفوظ، مش قابل لإعادة الاستخدام تلقائيًا). الطريقة الوحيدة إنه يرجع متاح
   لموظف تاني هي إن **الأدمن يفك التعيين يدويًا** (زرار "فك التعيين" في قسم 5/جدول الصلاحيات قسم 4 — لازم
   يشتغل على أي حالة claimed/won/lost مش بس claimed، ولما يتفك التعيين يمسح `claimedById` ويرجّع الحالة
   `available`).
5. حجم الشركة → قايمة ثابتة + "أخرى" نص حر.

---

## 0. السياق (من فحص الكود الحالي)

- **تسجيل الدخول حاليًا**: `src/lib/auth.ts` (`requireUser`) بيعتمد على Supabase Auth + جدول `users` بحقل
  `role` (نص حر، القيمة الافتراضية `"admin"`). صفحة `/team` بتدير المشرفين بس.
- **إنشاء حساب جاهز**: `createAdminAction` في `src/server/auth-actions.ts` بيستخدم
  `admin.auth.admin.createUser({ email, password, user_metadata: { name, role } })` ثم `prisma.user.upsert`.
  **هنعيد استخدام نفس النمط بالظبط** لإنشاء حساب دخول للموظف (`role: "employee"`).
- **تغيير الباسورد**: `changePasswordAction` حاليًا بيغيّر باسورد صاحب الجلسة نفسه بس (بيتحقق من الباسورد
  الحالي الأول). هيحتاج نسخة جديدة "غيّر باسورد شخص تاني" بصلاحيات مختلفة (قسم 4).
- **رفع الملفات**: `src/lib/storage.ts` فيه نمط validate+upload+signed-url جاهز (`employee-cvs` bucket كمثال
  حديث). هنستخدم نفس النمط لتقارير الليدز لو اترفعت كملف PDF. **التسجيل الصوتي مختلف تمامًا** — مش هيتخزن في
  Supabase Storage، هيترفع لجوجل درايف (قسم 3).
- **`Meeting` و`Reminder`**: حاليًا فيهم `createdBy` بس، ومفيش حقل "ده لمين/مخصص لمين". عشان "لو الأدمن عمل
  ميتنج باسم الموظف يظهرله في تقويمه"، لازم حقل تخصيص جديد.
- **التقويم/التذكيرات حاليًا**: الصفحات بتجيب كل الصفوف من غير فلترة حسب اليوزر (منطقي لأن كل المستخدمين
  أدمن بنفس الصلاحية). لما يبقى فيه موظفين، محتاجين فلترة حسب الشخص في نسخة الموظف من الصفحات.

---

## 1. قرارات محتاج أعرفها منك (حطيت افتراضي جنب كل واحدة عشان الشغل ميقفش)

1. **يوزرنيم الموظف**: Supabase Auth بيشتغل بإيميل مش يوزرنيم. يعني إما (أ) نديله إيميل حقيقي لو عنده،
   أو (ب) نولّد إيميل داخلي شكله `firstname@404legends.local` ونعرضه للموظف كـ"اسم المستخدم". **افتراضي:
   خيار (ب)** إلا لو تفضل غيره.
2. **جوجل درايف للتسجيلات الصوتية**: أسهل وأثبت طريقة هي **Google Service Account** له صلاحية على فولدر
   معين في Drive (تشاركه معاه بصلاحية Editor)، فمفيش حاجة تتطلب موافقة كل مستخدم كل مرة. البديل OAuth
   لحساب شخصي (أعقد وبينتهي الـ token). **افتراضي: Service Account** — هبعتلك خطوات إنشاءه لما نوصل
   للتنفيذ الفعلي.
3. **"إبراهيم" كسوبر أدمن**: هيتحدد بفلاج `isSuperAdmin` في قاعدة البيانات، **متاح بس من الداتابيز/الميجريشن
   مش من واجهة الاستخدام**، عشان محدش يقدر يدّي نفسه الصلاحية دي. محتاج إيميله بالظبط.
4. **لما الديل "يفشل" (خطأ)**: هل العميل المستهدف يرجع "متاح" لموظف تاني يجرب معاه، ولا يتقفل خالص لحد ما
   الأدمن يفتحه يدويًا؟ **افتراضي: يرجع "متاح" تلقائيًا** إلا لو الأدمن حط حالته "غير نشط" بنفسه.
5. **حجم الشركة**: قايمة ثابتة (صغيرة/متوسطة/كبيرة) ولا نص حر؟ **افتراضي: قايمة ثابتة + "أخرى" نص حر.**

---

## 2. تعديلات قاعدة البيانات

### 2.1 `User`
```prisma
model User {
  // ...الموجود...
  isSuperAdmin Boolean @default(false) @map("is_super_admin")
  employeeProfile Employee? @relation("EmployeeUser")
}
```
`isSuperAdmin` تتحط `true` لإبراهيم بس، يدويًا في الميجريشن/seed، مفيش UI لتغييرها.

### 2.2 `Employee` — ربطها بحساب دخول
```prisma
model Employee {
  // ...الموجود...
  userId String? @unique @map("user_id") @db.Uuid
  user   User?   @relation("EmployeeUser", fields: [userId], references: [id], onDelete: SetNull)

  claimedTargetClients   TargetClient[]         @relation("TargetClientClaimedBy")
  targetClientActivities TargetClientActivity[]
}
```
لازم تحديث تعليق الموديل في السكيما (بيقول حاليًا "no login") عشان يبقى دقيق.

### 2.3 `Meeting` و`Reminder` — تخصيص لشخص معيّن
```prisma
// في كل من الموديلين:
assignedToUserId String? @map("assigned_to_user_id") @db.Uuid
assignedTo       User?   @relation("MeetingAssignedTo" /* أو "ReminderAssignedTo" */, fields: [assignedToUserId], references: [id], onDelete: SetNull)
```

### 2.4 العملاء المستهدفون — موديلات جديدة

```prisma
enum TargetClientStatus {
  available
  claimed
  won
  lost
  inactive
}

enum TargetClientActivityKind {
  note
  report
  voice_call
}

model TargetClient {
  id            String             @id @default(uuid()) @db.Uuid
  companyName   String             @map("company_name")
  contactPhones String[]           @map("contact_phones")
  socialLinks   Json?              @map("social_links") // {facebook, instagram, whatsapp, ...}
  website       String?
  companySize   String?            @map("company_size")
  script        String?            // سكربت التعامل مع العميل
  notes         String?
  status        TargetClientStatus @default(available)
  hidden        Boolean            @default(false) @map("hidden_from_employees")
  claimedById   String?            @map("claimed_by_id") @db.Uuid
  claimedAt     DateTime?          @map("claimed_at")
  closedAt      DateTime?          @map("closed_at")
  createdBy     String?            @map("created_by") @db.Uuid
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")

  claimedBy  Employee?              @relation("TargetClientClaimedBy", fields: [claimedById], references: [id], onDelete: SetNull)
  creator    User?                  @relation("TargetClientCreatedBy", fields: [createdBy], references: [id], onDelete: SetNull)
  activities TargetClientActivity[]

  @@index([status])
  @@index([hidden])
  @@map("target_clients")
}

model TargetClientActivity {
  id              String                    @id @default(uuid()) @db.Uuid
  targetClientId  String                    @map("target_client_id") @db.Uuid
  employeeId      String?                   @map("employee_id") @db.Uuid
  kind            TargetClientActivityKind
  body            String?                   // نص الملاحظة/التقرير
  fileStorageKey  String?                   @map("file_storage_key") // تقرير كملف (اختياري)
  fileName        String?                   @map("file_name")
  driveFileId     String?                   @map("drive_file_id")    // فويس كول
  driveWebLink    String?                   @map("drive_web_link")
  durationSeconds Int?                      @map("duration_seconds")
  createdAt       DateTime                  @default(now()) @map("created_at")

  targetClient TargetClient @relation(fields: [targetClientId], references: [id], onDelete: Cascade)
  employee     Employee?    @relation(fields: [employeeId], references: [id], onDelete: SetNull)

  @@index([targetClientId])
  @@index([kind])
  @@map("target_client_activities")
}
```

ملحوظة تصميم: وحّدت "الملاحظة/التقرير/الفويس كول" في موديل واحد (`TargetClientActivity`) بدل 3 جداول
منفصلة — ده بيدّينا تايم لاين واحد مرتب بالتاريخ لكل عميل مستهدف (زي فكرة `buildActivityFeed` الموجودة
فعلاً في `src/lib/services/activity.ts`)، وأسهل في العرض والتقارير.

### 2.5 Storage bucket جديد
`target-client-reports` (نفس نمط `employee-cvs` في `src/lib/storage.ts` — PDF بحد أقصى معقول، مثلاً 10MB).

### 2.6 Announcement (إعلان عام)
```prisma
model Announcement {
  id        String    @id @default(uuid()) @db.Uuid
  title     String
  body      String?
  meetingAt DateTime? @map("meeting_at") // لو موجودة، الإعلان يظهر كحدث في التقويم لكل الناس
  createdBy String?   @map("created_by") @db.Uuid
  createdAt DateTime  @default(now()) @map("created_at")

  creator User? @relation("AnnouncementCreatedBy", fields: [createdBy], references: [id], onDelete: SetNull)

  @@map("announcements")
}
```
عند الإنشاء: يتعمل صف `Notification` تلقائي لكل الـ `User` (أدمن + موظفين)، ولو فيه `meetingAt` يتضاف كنوع
حدث جديد في `src/lib/services/calendar.ts` (`announcementToEvent`) عشان يظهر لكل الناس في التقويم.

---

## 3. تكامل Google Drive (التسجيلات الصوتية)

1. إنشاء **Google Service Account** من Google Cloud Console + تفعيل Drive API.
2. مشاركة فولدر معيّن في Google Drive مع إيميل الـ Service Account بصلاحية **Editor**.
3. Env vars جديدة (تتضاف لـ `.env.local` + `.env.example`):
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
   - `GOOGLE_DRIVE_FOLDER_ID`
4. مكتبة جديدة: `googleapis` (تتضاف لـ `package.json`).
5. **الفرونت إند**: زرار "تسجيل صوتي" في صفحة تفاصيل العميل المستهدف، بيستخدم `MediaRecorder` (متصفح) —
   يبدأ التسجيل، ولما يوقف يرفع الـ Blob (WebM/MP3) لـ API route داخلي.
6. **الباك إند**: `src/app/api/target-clients/[id]/voice/route.ts` — يستقبل الملف، يتحقق من الحجم/المدة،
   يرفعه لجوجل درايف (`drive.files.create`)، يحفظ `driveFileId` + `webViewLink` في صف
   `TargetClientActivity(kind: voice_call)`.
7. قيود مقترحة: حد أقصى 25MB و/أو 15 دقيقة للتسجيل الواحد (نفس فلسفة قيود ملفات CV الموجودة).

---

## 4. جدول الصلاحيات (Permissions Matrix)

| الإجراء | أدمن عادي | إبراهيم (سوبر أدمن) | موظف |
|---|---|---|---|
| إضافة/حذف عميل مستهدف | ✅ | ✅ | ❌ |
| رؤية كل العملاء المستهدفين | ✅ | ✅ | فقط "المتاحين وغير المخفيين" + اللي عمل عليهم claim |
| تعليم عميل "اشتغلت عليه" (claim) | ❌ | ❌ | ✅ (لو الحالة available) |
| فك تعيين موظف عن عميل | ✅ | ✅ | ❌ |
| تحديد نتيجة الديل (نجح/فشل) | ✅ (تصحيح) | ✅ | ✅ (على عملائه هو بس) |
| إضافة تقرير/ملاحظة/فويس | ✅ | ✅ | ✅ (على عملائه هو بس) |
| حذف تقرير/فويس | ✅ | ✅ | ❌ |
| إخفاء عميل عن الموظفين | ✅ | ✅ | ❌ |
| تعطيل عميل (Inactive) | ✅ | ✅ | ❌ |
| إنشاء حساب دخول لموظف جديد | ✅ | ✅ | ❌ |
| تغيير باسورد موظف | ✅ (أي أدمن) | ✅ | ❌ |
| تغيير باسورد أدمن تاني | ❌ | ✅ فقط | ❌ |
| عمل إعلان عام | ✅ | ✅ | ❌ |

---

## 5. صفحات الأدمن (جديدة/مُعدّلة)

- `/target-clients` — قائمة كل الليدز + فلاتر (الحالة، الموظف المسؤول، ظاهر/مخفي) + زرار إضافة عميل مستهدف.
- `/target-clients/[id]` — تفاصيل الشركة، السكربت، مين شغال عليه، تايم لاين الأنشطة (ملاحظة/تقرير/فويس)،
  أزرار: فك التعيين، إخفاء، تعطيل، حذف نشاط.
- صفحة `/employees/[id]` (من المرحلة 4): إضافة زرار **"إنشاء حساب دخول"** يفتح فورم شبيه بـ `AddAdminForm`
  بس بـ `role: "employee"`، ويربط الـ `User` الناتج بـ `Employee.userId`.
- `ChangePasswordForm`/`changePasswordAction`: نسخة جديدة "غيّر باسورد شخص تاني" مع فحص صلاحية:
  أدمن عادي → بس على `role === "employee"`؛ `isSuperAdmin` → على أي حد.
- `/announcements` (أو فورم سريع في الداشبورد): عنوان + نص + تاريخ/ميعاد اختياري.

---

## 6. بوابة الموظف (Employee Portal)

- Route group جديد، مثلاً `src/app/(employee)/...`، بعد تسجيل الدخول لو `role === "employee"` يتحول ليه
  بدل `(app)`.
- **الداشبورد**: عدد المشاريع الشغال عليها، عدد العملاء (المستهدفين) اللي كسبهم، إجمالي الكوموشن
  المستحق/المستلم، إجمالي المخصوم منه.
- **العملاء المستهدفين بتاعته**: تبويبين — "المتاحين" (يقدر ياخد واحد جديد بـ claim) و"عملائي" (اللي أخدهم
  فعلاً، بتايم لاين الأنشطة وإمكانية إضافة ملاحظة/تقرير/فويس وتحديد نتيجة الديل).
- **مشاريعه**: من `ProjectAssignment` (role=employee, employeeId = بتاعه) — اسم المشروع، العميل، الحالة،
  الكوموشن (من `EmployeePayment` بتاعته — القيمة بيحددها الأدمن، الموظف بيشوفها بس).
- **التقويم/التذكيرات**: بيشوف بس اللي `assignedToUserId = هو` أو `createdBy = هو`، ويقدر يضيف تذكيرات/مواعيد
  لنفسه — تظهر تلقائيًا عند الأدمن في نفس التقويم العام (مفيش فلترة عند الأدمن).
- **التقارير**: يقدر يطلع تقرير عن نفسه بس (نفس منطق تقرير الموظف من المرحلة 4، مقفول على حسابه هو).

---

## 7. الحراسة والصلاحيات في الكود

- تحديث `requireUser()` في `src/lib/auth.ts` عشان يرجّع `isSuperAdmin` وأي بيانات لازمة.
- إضافة `requireAdmin()` و`requireEmployee()` كـ helpers بترمي/تعمل `redirect` لو الدور غلط.
- كل Layout في الـ route groups الجديدة يستخدم الـ helper المناسب.
- كل Server Action خاصة بالعملاء المستهدفين تتحقق إن الموظف بيعدّل بس على العميل اللي هو `claimedById` بتاعه.

---

## 8. ترتيب تنفيذ مقترح (Sprint order)

1. تعديلات السكيما: `User.isSuperAdmin`, `Employee.userId`, تخصيص `Meeting`/`Reminder` + migration.
2. تفعيل تسجيل دخول الموظف (`createEmployeeLoginAction`) + زرار "إنشاء حساب دخول" في `/employees/[id]`.
3. هرمية الباسورد (سوبر أدمن + تغيير باسورد الغير).
4. موديلات وصفحات العملاء المستهدفين — الأساسيات (بدون فويس كول): إضافة/تعديل/claim/نتيجة الديل/إخفاء/تعطيل
   + ملاحظات وتقارير كملف/نص.
5. تكامل Google Drive + زرار التسجيل الصوتي (بعد ما توصلنا بيانات الـ Service Account منك).
6. بوابة الموظف: Route group جديد + الداشبورد + عملاؤه المستهدفين + مشاريعه.
7. التقويم/التذكيرات المخصصة للموظف (فلترة حسب `assignedToUserId`/`createdBy`).
8. تقرير "عن نفسي" للموظف.
9. الإعلانات (`Announcement`) + ربطها بالتقويم/الإشعارات/التذكيرات.
10. QA شامل: التأكد إن موظف مايقدرش يشوف عميل مستهدف مش بتاعه، ولا بيانات موظف تاني، ولا يغيّر باسورد حد.

---

## 9. حاجات محتاجها منك قبل/أثناء التنفيذ

- قرار: إيميل حقيقي لكل موظف ولا إيميل داخلي مُولّد؟ (قسم 1، بند 1)
- بيانات Google Service Account (أو تفضيل OAuth؟) + تحديد فولدر Drive المستهدف. (قسم 1، بند 2)
- تأكيد إيميل "إبراهيم" بالظبط عشان يتحط عليه `isSuperAdmin = true`. (قسم 1، بند 3)
- تأكيد سلوك الليد بعد "فشل الديل" — يرجع متاح لغيره ولا يتقفل. (قسم 1، بند 4)
- شكل "حجم الشركة" — قايمة ثابتة ولا نص حر. (قسم 1، بند 5)
