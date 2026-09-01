import { Prisma } from "@prisma/client";

export const CURRENCIES = ["EGP", "USD", "SAR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(v: string): v is Currency {
  return (CURRENCIES as readonly string[]).includes(v);
}

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const RATE_RE = /^\d+(\.\d{1,6})?$/;

/**
 * Resolve the exchange rate and compute the frozen EGP amount.
 * EGP always has rate 1. Non-EGP requires a positive manual rate.
 * amount_egp is stored as-is and never recomputed later (نقطة 0).
 */
export function resolveEgp(
  amountOriginal: Prisma.Decimal,
  currency: Currency,
  rawRate: string,
): { rate: Prisma.Decimal; amountEgp: Prisma.Decimal; error?: string } {
  if (currency === "EGP") {
    const rate = new Prisma.Decimal(1);
    return { rate, amountEgp: amountOriginal.mul(rate) };
  }
  const trimmed = rawRate.trim();
  if (!RATE_RE.test(trimmed) || new Prisma.Decimal(trimmed).lte(0)) {
    return {
      rate: new Prisma.Decimal(0),
      amountEgp: new Prisma.Decimal(0),
      error: "أدخل سعر صرف صحيحًا (رقم موجب).",
    };
  }
  const rate = new Prisma.Decimal(trimmed);
  // round the stored EGP value to 2 decimals
  return { rate, amountEgp: amountOriginal.mul(rate).toDecimalPlaces(2) };
}

function parseAmount(raw: string): { value: Prisma.Decimal; error?: string } {
  const t = raw.trim();
  if (!AMOUNT_RE.test(t)) {
    return { value: new Prisma.Decimal(0), error: "أدخل مبلغًا صحيحًا (حتى منزلتين عشريتين)." };
  }
  const value = new Prisma.Decimal(t);
  if (value.lte(0)) return { value, error: "المبلغ يجب أن يكون أكبر من صفر." };
  return { value };
}

// ─────────────────────────── Payment ───────────────────────────

export interface PaymentFormValues {
  clientId: string;
  projectId: string;
  amountOriginal: string;
  currency: string;
  exchangeRateToEgp: string;
  method: string;
  date: string;
  referenceNumber: string;
  notes: string;
}

export type FieldErrors = Record<string, string>;

export function parsePaymentForm(formData: FormData): {
  values: PaymentFormValues;
  errors: FieldErrors;
  parsed: {
    amountOriginal: Prisma.Decimal;
    currency: Currency;
    rate: Prisma.Decimal;
    amountEgp: Prisma.Decimal;
    date: Date | null;
  };
  confirmed: boolean;
} {
  const values: PaymentFormValues = {
    clientId: String(formData.get("clientId") ?? "").trim(),
    projectId: String(formData.get("projectId") ?? "").trim(),
    amountOriginal: String(formData.get("amountOriginal") ?? "").trim(),
    currency: String(formData.get("currency") ?? "EGP").trim(),
    exchangeRateToEgp: String(formData.get("exchangeRateToEgp") ?? "").trim(),
    method: String(formData.get("method") ?? "").trim(),
    date: String(formData.get("date") ?? "").trim(),
    referenceNumber: String(formData.get("referenceNumber") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
  const confirmed = formData.get("confirmed") === "1";
  const errors: FieldErrors = {};

  if (!values.clientId) errors.clientId = "اختر العميل.";
  if (!values.projectId) errors.projectId = "اختر المشروع.";
  if (!isCurrency(values.currency)) errors.currency = "عملة غير صالحة.";

  const amount = parseAmount(values.amountOriginal);
  if (amount.error) errors.amountOriginal = amount.error;

  const currency = (isCurrency(values.currency) ? values.currency : "EGP") as Currency;
  const egp = resolveEgp(amount.value, currency, values.exchangeRateToEgp);
  if (!amount.error && egp.error) errors.exchangeRateToEgp = egp.error;

  const date = values.date ? new Date(values.date) : null;
  if (!date || Number.isNaN(date.getTime())) errors.date = "أدخل تاريخًا صحيحًا.";

  return {
    values,
    errors,
    parsed: {
      amountOriginal: amount.value,
      currency,
      rate: egp.rate,
      amountEgp: egp.amountEgp,
      date,
    },
    confirmed,
  };
}

// ─────────────────────────── Expense ───────────────────────────

export interface ExpenseFormValues {
  type: string; // project | company
  projectId: string;
  categoryId: string;
  amountOriginal: string;
  currency: string;
  exchangeRateToEgp: string;
  date: string;
  description: string;
  paymentMethod: string;
  notes: string;
}

export function parseExpenseForm(formData: FormData): {
  values: ExpenseFormValues;
  errors: FieldErrors;
  parsed: {
    type: "project" | "company";
    amountOriginal: Prisma.Decimal;
    currency: Currency;
    rate: Prisma.Decimal;
    amountEgp: Prisma.Decimal;
    date: Date | null;
  };
} {
  const values: ExpenseFormValues = {
    type: String(formData.get("type") ?? "company").trim(),
    projectId: String(formData.get("projectId") ?? "").trim(),
    categoryId: String(formData.get("categoryId") ?? "").trim(),
    amountOriginal: String(formData.get("amountOriginal") ?? "").trim(),
    currency: String(formData.get("currency") ?? "EGP").trim(),
    exchangeRateToEgp: String(formData.get("exchangeRateToEgp") ?? "").trim(),
    date: String(formData.get("date") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    paymentMethod: String(formData.get("paymentMethod") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
  const errors: FieldErrors = {};

  const type = values.type === "project" ? "project" : "company";
  if (type === "project" && !values.projectId) {
    errors.projectId = "اختر المشروع.";
  }
  if (!values.categoryId) errors.categoryId = "اختر التصنيف.";
  if (!isCurrency(values.currency)) errors.currency = "عملة غير صالحة.";

  const amount = parseAmount(values.amountOriginal);
  if (amount.error) errors.amountOriginal = amount.error;

  const currency = (isCurrency(values.currency) ? values.currency : "EGP") as Currency;
  const egp = resolveEgp(amount.value, currency, values.exchangeRateToEgp);
  if (!amount.error && egp.error) errors.exchangeRateToEgp = egp.error;

  const date = values.date ? new Date(values.date) : null;
  if (!date || Number.isNaN(date.getTime())) errors.date = "أدخل تاريخًا صحيحًا.";

  return {
    values,
    errors,
    parsed: {
      type,
      amountOriginal: amount.value,
      currency,
      rate: egp.rate,
      amountEgp: egp.amountEgp,
      date,
    },
  };
}
