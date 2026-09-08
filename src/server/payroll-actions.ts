"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  parseEmployeePaymentForm,
  isDisbursement,
  PAY_TYPE_LABELS,
} from "@/lib/services/payroll";

export interface PayrollActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

/** Expense category used to book employee payments against a project. */
const PAYROLL_CATEGORY = "Salaries";

/**
 * Pay an employee. Decision 3: the money always comes from a project budget.
 *  - commission / fixed / bonus → Transaction(expense) + Expense(type: project)
 *    + EmployeePayment  (a real project cost)
 *  - deduction → Transaction(adjustment) + EmployeePayment only  (withheld from
 *    the employee's net; not a project expense)
 */
export async function payEmployeeAction(
  employeeId: string,
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseEmployeePaymentForm(formData);

  const back = (): PayrollActionState => ({
    fieldErrors: errors,
    values: values as unknown as Record<string, string>,
  });

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true },
  });
  if (!employee) return { error: "الموظف غير موجود." };

  let clientId: string | null = null;
  if (values.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: values.projectId },
      select: { id: true, clientId: true },
    });
    if (!project) errors.projectId = "المشروع غير موجود.";
    else clientId = project.clientId;
  }

  if (Object.keys(errors).length > 0) return back();

  const disburse = isDisbursement(parsed.payType);
  let category = null;
  if (disburse) {
    category = await prisma.expenseCategory.findFirst({
      where: { name: PAYROLL_CATEGORY },
    });
    if (!category) {
      category = await prisma.expenseCategory.findFirst({ orderBy: { name: "asc" } });
    }
    if (!category) return { error: "لا يوجد تصنيف مصروفات لتسجيل الدفعة." };
  }

  const label = PAY_TYPE_LABELS[parsed.payType];
  const desc = `${label} — ${employee.name}${values.notes ? ` (${values.notes})` : ""}`;

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: disburse ? "expense" : "adjustment",
        amountOriginal: parsed.amountOriginal,
        currency: parsed.currency,
        exchangeRateToEgp: parsed.rate,
        amountEgp: parsed.amountEgp,
        date: parsed.date!,
        description: desc,
        projectId: values.projectId,
        clientId,
        category: category?.name ?? null,
        createdBy: user.id,
      },
    });

    if (disburse && category) {
      await tx.expense.create({
        data: {
          type: "project",
          projectId: values.projectId,
          categoryId: category.id,
          transactionId: transaction.id,
          amountOriginal: parsed.amountOriginal,
          currency: parsed.currency,
          exchangeRateToEgp: parsed.rate,
          amountEgp: parsed.amountEgp,
          date: parsed.date!,
          description: desc,
          notes: values.notes || null,
          createdBy: user.id,
        },
      });
    }

    const payment = await tx.employeePayment.create({
      data: {
        employeeId,
        projectId: values.projectId,
        transactionId: transaction.id,
        payType: parsed.payType,
        amountOriginal: parsed.amountOriginal,
        currency: parsed.currency,
        exchangeRateToEgp: parsed.rate,
        amountEgp: parsed.amountEgp,
        date: parsed.date!,
        notes: values.notes || null,
        createdBy: user.id,
      },
    });

    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "employee_payment",
        entityId: payment.id,
        newValue: {
          employeeId,
          projectId: values.projectId,
          payType: parsed.payType,
          amountOriginal: parsed.amountOriginal.toString(),
          currency: parsed.currency,
          amountEgp: parsed.amountEgp.toString(),
        },
      },
      tx,
    );
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath(`/projects/${values.projectId}`);
  revalidatePath("/projects");
  revalidatePath("/expenses");
  return { ok: true };
}

/**
 * Reverse an employee payment: deletes the ledger transaction, which cascades
 * to the EmployeePayment and (for disbursements) the Expense row.
 */
export async function deleteEmployeePaymentAction(
  paymentId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const payment = await prisma.employeePayment.findUnique({
    where: { id: paymentId },
    select: {
      transactionId: true,
      employeeId: true,
      projectId: true,
      payType: true,
      amountEgp: true,
      currency: true,
    },
  });
  if (!payment) return { error: "الدفعة غير موجودة." };

  await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id: payment.transactionId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "deleted",
        entity: "employee_payment",
        entityId: paymentId,
        oldValue: {
          employeeId: payment.employeeId,
          projectId: payment.projectId,
          payType: payment.payType,
          currency: payment.currency,
          amountEgp: payment.amountEgp.toString(),
        },
      },
      tx,
    );
  });

  revalidatePath(`/employees/${payment.employeeId}`);
  revalidatePath(`/projects/${payment.projectId}`);
  revalidatePath("/projects");
  revalidatePath("/expenses");
  return {};
}
