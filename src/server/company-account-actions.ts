"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseCompanyEntryForm } from "@/lib/services/company-account";

export interface CompanyAccountActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

/**
 * Deposits and withdrawals are internal moves of company money — they use
 * `Transaction(type: "adjustment")` so they never touch the business
 * revenue / expense / cash-flow reports. The wallet balance is derived
 * purely from CompanyAccountEntry rows.
 */
async function createEntry(
  direction: "deposit" | "withdrawal",
  formData: FormData,
): Promise<CompanyAccountActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseCompanyEntryForm(formData);

  if (Object.keys(errors).length > 0) {
    return {
      fieldErrors: errors,
      values: values as unknown as Record<string, string>,
    };
  }

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: "adjustment",
        amountOriginal: parsed.amountOriginal,
        currency: parsed.currency,
        exchangeRateToEgp: parsed.rate,
        amountEgp: parsed.amountEgp,
        date: parsed.date!,
        description:
          (direction === "deposit" ? "إيداع في حساب الشركة" : "سحب من حساب الشركة") +
          (values.reason ? ` — ${values.reason}` : ""),
        createdBy: user.id,
      },
    });
    const entry = await tx.companyAccountEntry.create({
      data: {
        direction,
        transactionId: transaction.id,
        amountOriginal: parsed.amountOriginal,
        currency: parsed.currency,
        exchangeRateToEgp: parsed.rate,
        amountEgp: parsed.amountEgp,
        date: parsed.date!,
        reason: values.reason || null,
        createdBy: user.id,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "company_account",
        entityId: entry.id,
        newValue: {
          direction,
          amountOriginal: parsed.amountOriginal.toString(),
          currency: parsed.currency,
          amountEgp: parsed.amountEgp.toString(),
          reason: values.reason || null,
        },
      },
      tx,
    );
  });

  revalidatePath("/company-account");
  return { ok: true };
}

export async function depositToCompanyAccountAction(
  _prev: CompanyAccountActionState,
  formData: FormData,
): Promise<CompanyAccountActionState> {
  return createEntry("deposit", formData);
}

export async function withdrawFromCompanyAccountAction(
  _prev: CompanyAccountActionState,
  formData: FormData,
): Promise<CompanyAccountActionState> {
  return createEntry("withdrawal", formData);
}

/**
 * Reverse an entry: deletes the ledger transaction (the entry row cascades).
 * The audit log keeps the record.
 */
export async function deleteCompanyAccountEntryAction(
  entryId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const entry = await prisma.companyAccountEntry.findUnique({
    where: { id: entryId },
    select: {
      transactionId: true,
      direction: true,
      amountEgp: true,
      currency: true,
      reason: true,
    },
  });
  if (!entry) return { error: "الحركة غير موجودة." };

  await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id: entry.transactionId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "deleted",
        entity: "company_account",
        entityId: entryId,
        oldValue: {
          direction: entry.direction,
          currency: entry.currency,
          amountEgp: entry.amountEgp.toString(),
          reason: entry.reason,
        },
      },
      tx,
    );
  });

  revalidatePath("/company-account");
  return {};
}
