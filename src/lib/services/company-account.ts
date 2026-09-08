import { Prisma } from "@prisma/client";
import { sum } from "@/lib/money";
import { resolveEgp, isCurrency, type Currency } from "@/lib/services/transactions";
import type { FieldErrors } from "@/lib/services/transactions";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

export interface CompanyEntryFormValues {
  amountOriginal: string;
  currency: string;
  exchangeRateToEgp: string;
  date: string;
  reason: string;
}

export function parseCompanyEntryForm(formData: FormData): {
  values: CompanyEntryFormValues;
  errors: FieldErrors;
  parsed: {
    amountOriginal: Prisma.Decimal;
    currency: Currency;
    rate: Prisma.Decimal;
    amountEgp: Prisma.Decimal;
    date: Date | null;
  };
} {
  const values: CompanyEntryFormValues = {
    amountOriginal: String(formData.get("amountOriginal") ?? "").trim(),
    currency: String(formData.get("currency") ?? "EGP").trim(),
    exchangeRateToEgp: String(formData.get("exchangeRateToEgp") ?? "").trim(),
    date: String(formData.get("date") ?? "").trim(),
    reason: String(formData.get("reason") ?? "").trim(),
  };
  const errors: FieldErrors = {};

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
      amountOriginal: amount,
      currency,
      rate: egp.rate,
      amountEgp: egp.amountEgp,
      date,
    },
  };
}

// ─────────────────────────── Balance ───────────────────────────

export interface CompanyAccountSummary {
  /** Net EGP balance: Σ deposits − Σ withdrawals */
  balanceEgp: string;
  totalDepositsEgp: string;
  totalWithdrawalsEgp: string;
  entryCount: number;
  /** original-currency totals for currencies other than EGP */
  byCurrency: {
    currency: string;
    depositsOriginal: string;
    withdrawalsOriginal: string;
  }[];
}

interface EntryForSummary {
  direction: "deposit" | "withdrawal";
  amountEgp: Prisma.Decimal;
  amountOriginal: Prisma.Decimal;
  currency: string;
}

export function computeCompanyAccountSummary(
  entries: EntryForSummary[],
): CompanyAccountSummary {
  const deposits = entries.filter((e) => e.direction === "deposit");
  const withdrawals = entries.filter((e) => e.direction === "withdrawal");
  const totalIn = sum(deposits.map((e) => e.amountEgp));
  const totalOut = sum(withdrawals.map((e) => e.amountEgp));

  const cur = new Map<string, { inn: Prisma.Decimal; out: Prisma.Decimal }>();
  for (const e of entries) {
    if (e.currency === "EGP") continue;
    const c = cur.get(e.currency) ?? {
      inn: new Prisma.Decimal(0),
      out: new Prisma.Decimal(0),
    };
    if (e.direction === "deposit") c.inn = c.inn.plus(e.amountOriginal);
    else c.out = c.out.plus(e.amountOriginal);
    cur.set(e.currency, c);
  }

  return {
    balanceEgp: totalIn.minus(totalOut).toFixed(2),
    totalDepositsEgp: totalIn.toFixed(2),
    totalWithdrawalsEgp: totalOut.toFixed(2),
    entryCount: entries.length,
    byCurrency: [...cur.entries()].map(([currency, c]) => ({
      currency,
      depositsOriginal: c.inn.toFixed(2),
      withdrawalsOriginal: c.out.toFixed(2),
    })),
  };
}
