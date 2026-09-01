import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { formatEgp } from "@/lib/money";
import { computeProjectFinancials } from "@/lib/services/projects";
import { updateProjectAction } from "@/server/project-actions";
import { ProjectFormModal } from "../ProjectFormModal";
import { DeleteProjectButton } from "../DeleteProjectButton";
import { StatusChanger } from "./StatusChanger";

const toDateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [project, clients, statusRows] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        payments: { select: { amountEgp: true } },
        expenses: { where: { type: "project" }, select: { amountEgp: true } },
        _count: { select: { payments: true, expenses: true, files: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.projectStatus.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
  ]);

  if (!project) notFound();

  const statuses = statusRows.map((s) => s.name);
  const f = computeProjectFinancials(project);
  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });

  const updateAction = updateProjectAction.bind(null, project.id);

  const financialRows = [
    { label: "قيمة العقد", value: formatEgp(f.contractValue) },
    { label: "الخصم", value: formatEgp(f.discount) },
    { label: "القيمة النهائية للعقد", value: formatEgp(f.finalContractValue) },
    { label: "المدفوع", value: formatEgp(f.paid) },
    { label: "المتبقي", value: formatEgp(f.remaining) },
    { label: "مصروفات المشروع", value: formatEgp(f.projectExpenses) },
    { label: "ربح المشروع", value: formatEgp(f.profit) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/projects" className="text-accent hover:underline">
              المشاريع
            </Link>
            <span className="text-foreground-muted">/</span>
            <h1 className="text-xl font-semibold">{project.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-muted">
            <span>
              العميل:{" "}
              <Link
                href={`/clients/${project.client.id}`}
                className="text-accent hover:underline"
              >
                {project.client.name}
              </Link>
            </span>
            <span>
              البداية: {project.startDate ? dateFmt.format(project.startDate) : "—"}
            </span>
            <span>
              التسليم المتوقع:{" "}
              {project.expectedDeliveryDate
                ? dateFmt.format(project.expectedDeliveryDate)
                : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-foreground-muted">الحالة:</span>
            <StatusChanger
              projectId={project.id}
              current={project.status}
              statuses={statuses}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <ProjectFormModal
            mode="edit"
            action={updateAction}
            clients={clients}
            statuses={statuses}
            project={{
              clientId: project.clientId,
              name: project.name,
              description: project.description,
              status: project.status,
              startDate: toDateInput(project.startDate),
              expectedDeliveryDate: toDateInput(project.expectedDeliveryDate),
              contractValue: project.contractValue.toString(),
              discount: project.discount.toString(),
              notes: project.notes,
            }}
            triggerLabel="تعديل"
            triggerVariant="secondary"
          />
          <DeleteProjectButton projectId={project.id} projectName={project.name} />
        </div>
      </div>

      {/* Financial summary */}
      <Card>
        <h2 className="mb-4 text-base font-semibold">الملخّص المالي (بالجنيه المصري)</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {financialRows.map((r) => (
            <div key={r.label} className="rounded-md border border-border bg-surface-2 p-3">
              <dt className="text-xs text-foreground-muted">{r.label}</dt>
              <dd className="mt-1 font-semibold">{r.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Description */}
      <Card>
        <h2 className="mb-3 text-base font-semibold">وصف المشروع</h2>
        <p className="whitespace-pre-wrap text-sm text-foreground-muted">
          {project.description || "لا يوجد وصف."}
        </p>
      </Card>

      {/* Placeholder sections — implemented in نقاط 6 و 7 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <PlaceholderSection title="المدفوعات" note="تُضاف في النقطة 7" />
        <PlaceholderSection title="المصروفات" note="تُضاف في النقطة 7" />
        <PlaceholderSection title="الملفات" note="تُضاف في النقطة 6" />
        <PlaceholderSection title="النشاط" note="يُضاف في النقطة 8" />
      </div>
    </div>
  );
}

function PlaceholderSection({ title, note }: { title: string; note: string }) {
  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-foreground-muted">{note}</p>
    </Card>
  );
}
