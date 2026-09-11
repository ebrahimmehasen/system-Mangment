import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TARGET_CLIENT_STATUS_LABELS } from "@/lib/services/target-clients";
import { TargetClientActivityForm } from "@/components/target-clients/ActivityForm";
import { ClaimLeadButton } from "./ClaimLeadButton";
import { MarkResultButtons } from "./MarkResultButtons";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  available: "success",
  claimed: "accent",
  won: "success",
  lost: "danger",
  inactive: "neutral",
};

const ACTIVITY_KIND_LABELS: Record<string, string> = {
  note: "ملاحظة",
  report: "تقرير",
  voice_call: "مكالمة صوتية",
};

export default async function EmployeeLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: user.id } });

  const lead = await prisma.targetClient.findUnique({
    where: { id },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
        include: { employee: { select: { name: true } } },
      },
    },
  });
  if (!lead) notFound();

  const isMine = lead.claimedById === employee.id;
  const isAvailable = lead.status === "available" && !lead.hidden;
  // An employee may only see a lead that's open to claim or one they hold.
  if (!isMine && !isAvailable) notFound();

  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  const socialLinks = (lead.socialLinks as Record<string, string> | null) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/employee/leads" className="text-sm text-accent hover:underline">
            العملاء المستهدفون
          </Link>
          <span className="text-foreground-muted">/</span>
          <h1 className="text-xl font-semibold">{lead.companyName}</h1>
          <Badge tone={STATUS_TONE[lead.status]}>{TARGET_CLIENT_STATUS_LABELS[lead.status]}</Badge>
        </div>
        {lead.companySize && (
          <p className="mt-1 text-sm text-foreground-muted">{lead.companySize}</p>
        )}
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold">بيانات الشركة</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Info label="أرقام التواصل" value={lead.contactPhones.join(" — ")} ltr />
          <Info label="الموقع الإلكتروني" value={lead.website} ltr />
          <Info label="فيسبوك" value={socialLinks?.facebook} ltr />
          <Info label="إنستجرام" value={socialLinks?.instagram} ltr />
          <Info label="واتساب" value={socialLinks?.whatsapp} ltr />
        </dl>
        {lead.script && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-1 text-xs text-foreground-muted">سكربت التعامل مع العميل</p>
            <p className="whitespace-pre-wrap text-sm">{lead.script}</p>
          </div>
        )}
      </Card>

      <Card>
        {isAvailable && !isMine && (
          <>
            <h2 className="mb-3 text-base font-semibold">العميل ده متاح</h2>
            <ClaimLeadButton targetClientId={lead.id} />
          </>
        )}
        {isMine && lead.status === "claimed" && (
          <>
            <h2 className="mb-3 text-base font-semibold">نتيجة الديل</h2>
            <MarkResultButtons targetClientId={lead.id} />
          </>
        )}
        {isMine && (lead.status === "won" || lead.status === "lost") && (
          <p className="text-sm text-foreground-muted">
            اتحدد إن الديل ده {lead.status === "won" ? "نجح ✅" : "فشل ❌"}. لو محتاج تعيد فتحه، كلّم الأدمن
            يفك التعيين.
          </p>
        )}
      </Card>

      {isMine && (
        <Card>
          <h2 className="mb-4 text-base font-semibold">
            التايم لاين ({lead.activities.length})
          </h2>
          <TargetClientActivityForm targetClientId={lead.id} />

          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4">
            {lead.activities.length === 0 && (
              <p className="text-sm text-foreground-muted">لا يوجد نشاط بعد.</p>
            )}
            {lead.activities.map((a) => (
              <div key={a.id} className="rounded-md border border-border bg-surface-2 p-3">
                <div className="flex items-center gap-2">
                  <Badge tone={a.kind === "report" ? "accent" : "neutral"}>
                    {ACTIVITY_KIND_LABELS[a.kind]}
                  </Badge>
                  <span className="text-xs text-foreground-muted">
                    {a.employee?.name ?? "أدمن"} — {dateFmt.format(a.createdAt)}
                  </span>
                </div>
                {a.body && <p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p>}
                {a.fileName && (
                  <p className="mt-2 text-xs text-foreground-muted">مرفق: {a.fileName}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Info({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string | null | undefined;
  ltr?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd dir={ltr ? "ltr" : undefined} className={ltr ? "mt-0.5 text-right" : "mt-0.5"}>
        {value || "—"}
      </dd>
    </div>
  );
}
