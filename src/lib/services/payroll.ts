import { Prisma } from "@prisma/client";
import { sum } from "@/lib/money";
import {
  resolveEgp,
  isCurrency,
  type Currency,
  type FieldErrors,
} from "@/lib/services/transactions";

export const PAY_TYPES = ["commission", "fixed", "bonus", "deduction"] as const;
export type PayType = (typeof PAY_TYPES)[number];

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  commission: "عمولة",
  fixed: "راتب / مبلغ ثابت",
  bonus: "مكافأة",
  deduction: "خصم",
};

/** commission / fixed / bonus are money paid out of the project budget. */
export const isDisbursement = (t: PayType) => t !== "deduction";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

export interface EmployeePaymentFormValues {
  projectId: string;
  payType: string;
  amountOriginal: string;
  currency: string;
  exchangeRateToEgp: string;
  date: string;
  notes: string;
}

export function parseEmployeePaymentForm(formData: FormData): {
  values: EmployeePaymentFormValues;
  errors: FieldErrors;
  parsed: {
    payType: PayType;
    amountOriginal: Prisma.Decimal;
    currency: Currency;
    rate: Prisma.Decimal;
    amountEgp: Prisma.Decimal;
    date: Date | null;
  };
} {
  const values: EmployeePaymentFormValues = {
    projectId: String(formData.get("projectId") ?? "").trim(),
    payType: String(formData.get("payType") ?? "").trim(),
    amountOriginal: String(formData.get("amountOriginal") ?? "").trim(),
    currency: String(formData.get("currency") ?? "EGP").trim(),
    exchangeRateToEgp: String(formData.get("exchangeRateToEgp") ?? "").trim(),
    date: String(formData.get("date") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
  const errors: FieldErrors = {};

  const payType = (PAY_TYPES as readonly string[]).includes(values.payType)
    ? (values.payType as PayType)
    : "commission";
  if (!(PAY_TYPES as readonly string[]).includes(values.payType)) {
    errors.payType = "نوع الدفعة غير صالح.";
  }
  if (!values.projectId) errors.projectId = "اختر المشروع.";
  if (!isCurrency(values.currency)) errors.currency = "عملة غير صالحة.";

  let amount = new Prisma.Decimal(0);
  if (!AMOUNT_RE.test(values.amountOriginal)) {
    errors.amountOriginal = "أدخل مبلغًا صحيحًا (حتى منزلتين عشريتين).";
  } else {
    amount = new Prisma.Decimal(values.amountOriginal);
    if (amount.lte(0)) errors.amountOriginal = "المبلغ يجب أن يكون أكبر من صفر.";
  }

  const currency = (isCurrency(values.currency) ? values.currency : "EGP") as Currency;
  const egp = resolveEgp(amount, currency, values.exchangeRateToEgp);
  if (!errors.amountOriginal && egp.error) errors.exchangeRateToEgp = egp.error;

  const date = values.date ? new Date(values.date) : null;
  if (!date || Number.isNaN(date.getTime())) errors.date = "أدخل تاريخًا صحيحًا.";

  return {
    values,
    errors,
    parsed: {
      payType,
      amountOriginal: amount,
      currency,
      rate: egp.rate,
      amountEgp: egp.amountEgp,
      date,
    },
  };
}

// ─────────────────────── Summary ───────────────────────

interface PaymentForSummary {
  payType: string;
  amountEgp: Prisma.Decimal;
  projectId: string;
  project: { name: string; client: { name: string } };
}

export interface PayrollProjectRow {
  projectId: string;
  projectName: string;
  clientName: string;
  disbursed: string;
  deducted: string;
  net: string;
}

export interface PayrollSummary {
  disbursed: string;
  deducted: string;
  net: string;
  byProject: PayrollProjectRow[];
}

/**
 * disbursed = Σ commission+fixed+bonus (paid out of project budgets)
 * deducted  = Σ deduction (withheld from the employee)
 * net       = disbursed − deducted (what the employee actually received)
 */
export function computeEmployeePayrollSummary(
  payments: PaymentForSummary[],
): PayrollSummary {
  const disb = payments.filter((p) => p.payType !== "deduction");
  const ded = payments.filter((p) => p.payType === "deduction");

  const byId = new Map<
    string,
    { name: string; client: string; d: Prisma.Decimal; x: Prisma.Decimal }
  >();
  for (const p of payments) {
    const e = byId.get(p.projectId) ?? {
      name: p.project.name,
      client: p.project.client.name,
      d: new Prisma.Decimal(0),
      x: new Prisma.Decimal(0),
    };
    if (p.payType === "deduction") e.x = e.x.plus(p.amountEgp);
    else e.d = e.d.plus(p.amountEgp);
    byId.set(p.projectId, e);
  }

  const totalD = sum(disb.map((p) => p.amountEgp));
  const totalX = sum(ded.map((p) => p.amountEgp));

  return {
    disbursed: totalD.toFixed(2),
    deducted: totalX.toFixed(2),
    net: totalD.minus(totalX).toFixed(2),
    byProject: [...byId.entries()].map(([projectId, e]) => ({
      projectId,
      projectName: e.name,
      clientName: e.client,
      disbursed: e.d.toFixed(2),
      deducted: e.x.toFixed(2),
      net: e.d.minus(e.x).toFixed(2),
    })),
  };
}
