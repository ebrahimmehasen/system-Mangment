"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseExpenseForm } from "@/lib/services/transactions";

export interface ExpenseActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

export async function createExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseExpenseForm(formData);

  const back = () => ({
    fieldErrors: errors,
    values: values as unknown as Record<string, string>,
  });

  const category = values.categoryId
    ? await prisma.expenseCategory.findUnique({ where: { id: values.categoryId } })
    : null;
  if (values.categoryId && !category) errors.categoryId = "تصنيف غير موجود.";

  let projectId: string | null = null;
  let clientId: string | null = null;
  if (parsed.type === "project" && values.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: values.projectId },
      select: { id: true, clientId: true },
    });
    if (!project) errors.projectId = "المشروع غير موجود.";
    else {
      projectId = project.id;
      clientId = project.clientId;
    }
  }

  if (Object.keys(errors).length > 0) return back();

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: "expense",
        amountOriginal: parsed.amountOriginal,
        currency: parsed.currency,
        exchangeRateToEgp: parsed.rate,
        amountEgp: parsed.amountEgp,
        date: parsed.date!,
        description: values.description || null,
        clientId,
        projectId,
        category: category?.name ?? null,
        paymentMethod: values.paymentMethod || null,
        createdBy: user.id,
      },
    });
    const expense = await tx.expense.create({
      data: {
        type: parsed.type,
        projectId,
        categoryId: values.categoryId,
        transactionId: transaction.id,
        amountOriginal: parsed.amountOriginal,
        currency: parsed.currency,
        exchangeRateToEgp: parsed.rate,
        amountEgp: parsed.amountEgp,
        date: parsed.date!,
        description: values.description || null,
        paymentMethod: values.paymentMethod || null,
        notes: values.notes || null,
        createdBy: user.id,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "expense_created",
        entity: "expense",
        entityId: expense.id,
        newValue: {
          type: parsed.type,
          projectId,
          categoryId: values.categoryId,
          amountOriginal: parsed.amountOriginal.toString(),
          currency: parsed.currency,
          amountEgp: parsed.amountEgp.toString(),
        },
      },
      tx,
    );
  });

  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
  }
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/expenses");
  return { ok: true };
}

/**
 * Decision (نقطة 8): an expense entry and its ledger transaction are one
 * unit in the UI. Deleting an expense removes both (transaction cascades),
 * logged as `expense_deleted` — the audit log keeps the full history.
 * Payments have no delete: money received from a client is only ever
 * corrected via a future reversal, never erased.
 */
export async function deleteExpenseAction(
  expenseId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: {
      id: true,
      type: true,
      projectId: true,
      transactionId: true,
      amountEgp: true,
      categoryId: true,
    },
  });
  if (!expense) return { error: "المصروف غير موجود." };

  await prisma.$transaction(async (tx) => {
    // deleting the transaction cascades to the expense row
    await tx.transaction.delete({ where: { id: expense.transactionId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "expense_deleted",
        entity: "expense",
        entityId: expenseId,
        oldValue: {
          type: expense.type,
          projectId: expense.projectId,
          categoryId: expense.categoryId,
          amountEgp: expense.amountEgp.toString(),
        },
      },
      tx,
    );
  });

  if (expense.projectId) {
    revalidatePath(`/projects/${expense.projectId}`);
    revalidatePath("/projects");
  }
  revalidatePath("/expenses");
  return {};
}
