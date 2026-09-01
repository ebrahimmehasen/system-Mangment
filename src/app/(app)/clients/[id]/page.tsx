import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatEgp } from "@/lib/money";
import { computeClientFinancialSummary } from "@/lib/services/clients";
import { updateClientAction } from "@/server/client-actions";
import { createProjectAction } from "@/server/project-actions";
import { ClientFormModal } from "../ClientFormModal";
import { DeleteClientButton } from "../DeleteClientButton";
import { ProjectFormModal } from "../../projects/ProjectFormModal";
import { MeetingsTable } from "@/components/calendar/MeetingsTable";
import { MeetingFormModal } from "@/components/calendar/MeetingFormModal";
import { createMeetingAction } from "@/server/meeting-actions";

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
        include: {
          payments: { select: { amountEgp: true } },
          expenses: {
            where: { type: "project" },
            select: { amountEgp: true },
          },
        },
      },
    },
  });

  if (!client) notFound();

  const [statusRows, meetings] = await Promise.all([
    prisma.projectStatus.findMany({
      orderBy: { sortOrder: "asc" },
      select: { name: true },
    }),
    prisma.meeting.findMany({
      where: { clientId: id },
      orderBy: { meetingAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
  ]);
  const statuses = statusRows.map((s) => s.name);
  const clientProjectOpts = client.projects.map((p) => ({
    id: p.id,
    name: p.name,
    clientId: client.id,
  }));

  const summary = computeClientFinancialSummary(client.projects);
  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });

  const updateAction = updateClientAction.bind(null, client.id);

  const rows: { label: string; value: string }[] = [
    { label: "إجمالي قيمة المشاريع (بعد الخصم)", value: formatEgp(summary.totalFinalContractValue) },
    { label: "إجمالي المدفوع", value: formatEgp(summary.totalPaid) },
    { label: "إجمالي الخصومات", value: formatEgp(summary.totalDiscounts) },
    { label: "إجمالي المتبقي", value: formatEgp(summary.totalRemaining) },
    { label: "إجمالي المصروفات على مشاريعه", value: formatEgp(summary.totalProjectExpenses) },
    { label: "إجمالي الربح منه", value: formatEgp(summary.totalProfit) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/clients" className="text-sm text-accent hover:underline">
              العملاء
            </Link>
            <span className="text-foreground-muted">/</span>
            <h1 className="text-xl font-semibold">{client.name}</h1>
            <Badge tone={client.status === "active" ? "success" : "neutral"}>
              {client.status === "active" ? "نشط" : "غير نشط"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <ClientFormModal
            mode="edit"
            action={updateAction}
            client={{
              name: client.name,
              companyName: client.companyName,
              phone: client.phone,
              email: client.email,
              address: client.address,
              notes: client.notes,
              status: client.status,
            }}
            triggerLabel="تعديل"
            triggerVariant="secondary"
          />
          <DeleteClientButton clientId={client.id} clientName={client.name} />
        </div>
      </div>

      {/* Basic information */}
      <Card>
        <h2 className="mb-4 text-base font-semibold">المعلومات الأساسية</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Info label="اسم الشركة" value={client.companyName} />
          <Info label="الهاتف" value={client.phone} ltr />
          <Info label="البريد الإلكتروني" value={client.email} ltr />
          <Info label="العنوان" value={client.address} />
          <Info label="أُضيف في" value={dateFmt.format(client.createdAt)} />
          <Info label="ملاحظات" value={client.notes} />
        </dl>
      </Card>

      {/* Financial summary */}
      <Card>
        <h2 className="mb-4 text-base font-semibold">الملخّص المالي (بالجنيه المصري)</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.label}
              className="rounded-md border border-border bg-surface-2 p-3"
            >
              <dt className="text-xs text-foreground-muted">{r.label}</dt>
              <dd className="mt-1 font-semibold">{r.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Projects */}
      <Card className="p-0">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-base font-semibold">
            المشاريع ({client.projects.length})
          </h2>
          <ProjectFormModal
            mode="create"
            action={createProjectAction}
            clients={[{ id: client.id, name: client.name }]}
            statuses={statuses}
            project={{ clientId: client.id }}
            triggerLabel="+ مشروع جديد"
            triggerVariant="secondary"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">اسم المشروع</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">تاريخ البداية</th>
                <th className="px-4 py-3 font-medium">تاريخ التسليم المتوقع</th>
              </tr>
            </thead>
            <tbody>
              {client.projects.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-foreground-muted"
                  >
                    لا توجد مشاريع لهذا العميل بعد.
                  </td>
                </tr>
              )}
              {client.projects.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-accent hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {p.startDate ? dateFmt.format(p.startDate) : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {p.expectedDeliveryDate
                      ? dateFmt.format(p.expectedDeliveryDate)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Meetings */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
          <h2 className="text-base font-semibold">
            الاجتماعات ({meetings.length})
          </h2>
          <MeetingFormModal
            mode="create"
            action={createMeetingAction}
            clients={[{ id: client.id, name: client.name }]}
            projects={clientProjectOpts}
            fixedClientId={client.id}
            triggerLabel="+ اجتماع"
            triggerVariant="secondary"
          />
        </div>
        <MeetingsTable
          meetings={meetings}
          clients={[{ id: client.id, name: client.name }]}
          projects={clientProjectOpts}
          showContext={false}
          emptyText="لا توجد اجتماعات مع هذا العميل."
        />
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
  value: string | null;
  ltr?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd
        dir={ltr ? "ltr" : undefined}
        className={ltr ? "mt-0.5 text-right" : "mt-0.5"}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
