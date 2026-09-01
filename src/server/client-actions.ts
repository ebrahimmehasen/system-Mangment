"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseClientForm, toCreateData } from "@/lib/services/clients";

export interface ClientActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

function snapshot(c: {
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: string;
}) {
  return {
    name: c.name,
    companyName: c.companyName,
    phone: c.phone,
    email: c.email,
    address: c.address,
    notes: c.notes,
    status: c.status,
  };
}

export async function createClientAction(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const user = await requireUser();
  const { values, errors } = parseClientForm(formData);

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  const created = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: toCreateData(values, user.id),
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "client",
        entityId: client.id,
        newValue: snapshot(client),
      },
      tx,
    );
    return client;
  });

  revalidatePath("/clients");
  redirect(`/clients/${created.id}`);
}

export async function updateClientAction(
  clientId: string,
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const user = await requireUser();
  const { values, errors } = parseClientForm(formData);

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  const existing = await prisma.client.findUnique({ where: { id: clientId } });
  if (!existing) return { error: "العميل غير موجود." };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.client.update({
      where: { id: clientId },
      data: {
        name: values.name,
        companyName: values.companyName || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        notes: values.notes || null,
        status: values.status,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "client",
        entityId: clientId,
        oldValue: snapshot(existing),
        newValue: snapshot(updated),
      },
      tx,
    );
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function deleteClientAction(
  clientId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { _count: { select: { projects: true } } },
  });
  if (!client) return { error: "العميل غير موجود." };

  // Data-integrity rule (نقطة 0: "لا Project بدون Client"): a client that
  // still has projects cannot be deleted — those projects carry payments,
  // expenses and transactions. The user must remove/reassign the projects
  // first. (DB also enforces this via ON DELETE RESTRICT.)
  if (client._count.projects > 0) {
    return {
      error: `لا يمكن حذف العميل لوجود ${client._count.projects} مشروع مرتبط به. احذف أو انقل المشاريع أولًا.`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.client.delete({ where: { id: clientId } });
      await writeAuditLog(
        {
          userId: user.id,
          action: "deleted",
          entity: "client",
          entityId: clientId,
          oldValue: snapshot(client),
        },
        tx,
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { error: "لا يمكن حذف العميل لوجود سجلات مرتبطة به." };
    }
    throw e;
  }

  revalidatePath("/clients");
  redirect("/clients");
}
