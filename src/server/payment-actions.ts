"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { sum } from "@/lib/money";
import { parsePaymentForm } from "@/lib/services/transactions";

export interface PaymentActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  /** amount exceeds the project's remaining balance — needs an explicit confirm */
  needsConfirm?: string;
}

export async function createPaymentAction(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const user = await requireUser();
  const { values, errors, parsed, confirmed } = parsePaymentForm(formData);

  const back = () => ({
    fieldErrors: errors,
    values: values as unknown as Record<string, string>,
  });

  if (Object.keys(errors).length > 0) return back();

  const project = await prisma.project.findUnique({
    where: { id: values.projectId },
    select: {
      id: true,
      clientId: true,
      contractValue: true,
      discount: true,
      payments: { select: { amountEgp: true } },
    },
  });
  if (!project) {
    errors.projectId = "المشروع غير موجود.";
    return back();
  }
  if (project.clientId !== values.clientId) {
    errors.projectId = "المشروع لا يخص هذا العميل.";
    return back();
  }

  const remaining = new Prisma.Decimal(project.contractValue)
    .minus(project.discount)
    .minus(sum(project.payments.map((p) => p.amountEgp)));

  if (!confirmed && parsed.amountEgp.greaterThan(remaining)) {
    return {
      needsConfirm: `المبلغ (${parsed.amountEgp.toFixed(2)} ج.م) أكبر من المتبقي على المشروع (${remaining.toFixed(2)} ج.م). هل تريد المتابعة؟`,
      values: values as unknown as Record<string, string>,
    };
  }

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: "income",
        amountOriginal: parsed.amountOriginal,
        currency: parsed.currency,
        exchangeRateToEgp: parsed.rate,
        amountEgp: parsed.amountEgp,
        date: parsed.date!,
        description: values.notes || null,
        clientId: values.clientId,
        projectId: values.projectId,
        paymentMethod: values.method || null,
        createdBy: user.id,
      },
    });
    const payment = await tx.payment.create({
      data: {
        projectId: values.projectId,
        clientId: values.clientId,
        transactionId: transaction.id,
        amountOriginal: parsed.amountOriginal,
        currency: parsed.currency,
        exchangeRateToEgp: parsed.rate,
        amountEgp: parsed.amountEgp,
        method: values.method || null,
        date: parsed.date!,
        referenceNumber: values.referenceNumber || null,
        notes: values.notes || null,
        createdBy: user.id,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "payment_created",
        entity: "payment",
        entityId: payment.id,
        newValue: {
          projectId: values.projectId,
          clientId: values.clientId,
          amountOriginal: parsed.amountOriginal.toString(),
          currency: parsed.currency,
          exchangeRateToEgp: parsed.rate.toString(),
          amountEgp: parsed.amountEgp.toString(),
        },
      },
      tx,
    );
  });

  revalidatePath(`/projects/${values.projectId}`);
  revalidatePath(`/clients/${values.clientId}`);
  revalidatePath("/projects");
  revalidatePath("/payments");
  return { ok: true };
}
