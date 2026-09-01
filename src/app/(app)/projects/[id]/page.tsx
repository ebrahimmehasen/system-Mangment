import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { formatEgp } from "@/lib/money";
import { formatFileSize } from "@/lib/format";
import { computeProjectFinancials } from "@/lib/services/projects";
import { updateProjectAction } from "@/server/project-actions";
import { ProjectFormModal } from "../ProjectFormModal";
import { DeleteProjectButton } from "../DeleteProjectButton";
import { StatusChanger } from "./StatusChanger";
import { FileUploader } from "./FileUploader";
import { DeleteFileButton } from "./DeleteFileButton";

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
        files: {
          orderBy: { createdAt: "desc" },
          include: { uploader: { select: { name: true, email: true } } },
        },
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

      {/* Files */}
      <Card className="p-0">
        <div className="border-b border-border p-4">
          <h2 className="mb-3 text-base font-semibold">
            ملفات المشروع ({project.files.length})
          </h2>
          <FileUploader projectId={project.id} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">اسم الملف</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">الحجم</th>
                <th className="px-4 py-3 font-medium">رفعه</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {project.files.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">
                    لا توجد ملفات بعد.
                  </td>
                </tr>
              )}
              {project.files.map((file) => (
                <tr key={file.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{file.fileName}</td>
                  <td className="px-4 py-3 text-foreground-muted">PDF</td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {formatFileSize(file.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {file.uploader?.name || file.uploader?.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {dateFmt.format(file.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <a
                        href={`/api/projects/${project.id}/files/${file.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        عرض
                      </a>
                      <a
                        href={`/api/projects/${project.id}/files/${file.id}?mode=download`}
                        className="text-accent hover:underline"
                      >
                        تنزيل
                      </a>
                      <DeleteFileButton fileId={file.id} fileName={file.fileName} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Placeholder sections — implemented in نقاط 7 و 8 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <PlaceholderSection title="المدفوعات" note="تُضاف في النقطة 7" />
        <PlaceholderSection title="المصروفات" note="تُضاف في النقطة 7" />
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
