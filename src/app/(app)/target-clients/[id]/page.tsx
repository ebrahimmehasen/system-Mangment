import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TARGET_CLIENT_STATUS_LABELS } from "@/lib/services/target-clients";
import { updateTargetClientAction } from "@/server/target-client-actions";
import { TargetClientFormModal } from "../TargetClientFormModal";
import { TargetClientAdminActions } from "./TargetClientAdminActions";
import { TargetClientActivityForm } from "@/components/target-clients/ActivityForm";
import { DeleteActivityButton } from "./DeleteActivityButton";

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

export default async function TargetClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const targetClient = await prisma.targetClient.findUnique({
    where: { id },
    include: {
      claimedBy: { select: { name: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { employee: { select: { name: true } } },
      },
    },
  });
  if (!targetClient) notFound();

  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  const updateAction = updateTargetClientAction.bind(null, targetClient.id);
  const socialLinks = (targetClient.socialLinks as Record<string, string> | null) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/target-clients" className="text-sm text-accent hover:underline">
              العملاء المستهدفون
            </Link>
            <span className="text-foreground-muted">/</span>
            <h1 className="text-xl font-semibold">{targetClient.companyName}</h1>
            <Badge tone={STATUS_TONE[targetClient.status]}>
              {TARGET_CLIENT_STATUS_LABELS[targetClient.status]}
            </Badge>
            {targetClient.hidden && <Badge tone="neutral">مخفي عن الموظفين</Badge>}
          </div>
          {targetClient.companySize && (
            <p className="mt-1 text-sm text-foreground-muted">{targetClient.companySize}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <TargetClientFormModal
            mode="edit"
            action={updateAction}
            targetClient={{
              companyName: targetClient.companyName,
              phones: targetClient.contactPhones.join("\n"),
              facebook: socialLinks?.facebook ?? "",
              instagram: socialLinks?.instagram ?? "",
              whatsapp: socialLinks?.whatsapp ?? "",
              website: targetClient.website,
              companySize: targetClient.companySize,
              script: targetClient.script,
              notes: targetClient.notes,
            }}
            triggerLabel="تعديل"
            triggerVariant="secondary"
          />
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <h2 className="mb-4 text-base font-semibold">بيانات الشركة</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Info label="أرقام التواصل" value={targetClient.contactPhones.join(" — ") || null} ltr />
          <Info label="الموقع الإلكتروني" value={targetClient.website} ltr />
          <Info label="فيسبوك" value={socialLinks?.facebook} ltr />
          <Info label="إنستجرام" value={socialLinks?.instagram} ltr />
          <Info label="واتساب" value={socialLinks?.whatsapp} ltr />
          <Info label="أُضيف في" value={dateFmt.format(targetClient.createdAt)} />
          <Info label="شغال عليه" value={targetClient.claimedBy?.name} />
          <Info
            label="تاريخ آخر تحديث للحالة"
            value={targetClient.closedAt ? dateFmt.format(targetClient.closedAt) : null}
          />
        </dl>
        {targetClient.script && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-1 text-xs text-foreground-muted">سكربت التعامل مع العميل</p>
            <p className="whitespace-pre-wrap text-sm">{targetClient.script}</p>
          </div>
        )}
        {targetClient.notes && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-1 text-xs text-foreground-muted">ملاحظات</p>
            <p className="whitespace-pre-wrap text-sm">{targetClient.notes}</p>
          </div>
        )}
      </Card>

      {/* Admin actions */}
      <Card>
        <h2 className="mb-4 text-base font-semibold">إدارة العميل المستهدف</h2>
        <TargetClientAdminActions
          targetClientId={targetClient.id}
          companyName={targetClient.companyName}
          hidden={targetClient.hidden}
          status={targetClient.status}
          isClaimed={!!targetClient.claimedById}
        />
      </Card>

      {/* Activity timeline */}
      <Card>
        <h2 className="mb-4 text-base font-semibold">
          التايم لاين ({targetClient.activities.length})
        </h2>
        <TargetClientActivityForm targetClientId={targetClient.id} />

        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4">
          {targetClient.activities.length === 0 && (
            <p className="text-sm text-foreground-muted">لا يوجد نشاط بعد.</p>
          )}
          {targetClient.activities.map((a) => (
            <div key={a.id} className="rounded-md border border-border bg-surface-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={a.kind === "report" ? "accent" : "neutral"}>
                    {ACTIVITY_KIND_LABELS[a.kind]}
                  </Badge>
                  <span className="text-xs text-foreground-muted">
                    {a.employee?.name ?? "أدمن"} — {dateFmt.format(a.createdAt)}
                  </span>
                </div>
                <DeleteActivityButton activityId={a.id} />
              </div>
              {a.body && <p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p>}
              {a.fileName && (
                <p className="mt-2 text-xs text-foreground-muted">مرفق: {a.fileName}</p>
              )}
            </div>
          ))}
        </div>
      </Card>
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
