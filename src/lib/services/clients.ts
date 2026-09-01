import { Prisma } from "@prisma/client";
import { sum } from "@/lib/money";

// ─────────────────────────── Validation ───────────────────────────

export interface ClientFormValues {
  name: string;
  companyName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: "active" | "inactive";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseClientForm(formData: FormData): {
  values: ClientFormValues;
  errors: Partial<Record<keyof ClientFormValues, string>>;
} {
  const values: ClientFormValues = {
    name: String(formData.get("name") ?? "").trim(),
    companyName: String(formData.get("companyName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    status: formData.get("status") === "inactive" ? "inactive" : "active",
  };

  const errors: Partial<Record<keyof ClientFormValues, string>> = {};

  if (!values.name) errors.name = "اسم العميل مطلوب.";
  else if (values.name.length > 200) errors.name = "الاسم طويل جدًا.";

  if (values.email && !EMAIL_RE.test(values.email)) {
    errors.email = "صيغة البريد الإلكتروني غير صحيحة.";
  }
  if (values.phone && values.phone.length > 40) {
    errors.phone = "رقم الهاتف غير صحيح.";
  }

  return { values, errors };
}

export function toCreateData(v: ClientFormValues, createdBy: string) {
  return {
    name: v.name,
    companyName: v.companyName || null,
    phone: v.phone || null,
    email: v.email || null,
    address: v.address || null,
    notes: v.notes || null,
    status: v.status,
    createdBy,
  };
}

// ─────────────────────── Financial summary ────────────────────────

export interface ClientFinancialSummary {
  totalFinalContractValue: string;
  totalPaid: string;
  totalDiscounts: string;
  totalRemaining: string;
  totalProjectExpenses: string;
  totalProfit: string;
  projectCount: number;
}

interface ProjectForSummary {
  contractValue: Prisma.Decimal;
  discount: Prisma.Decimal;
  payments: { amountEgp: Prisma.Decimal }[];
  expenses: { amountEgp: Prisma.Decimal }[];
}

/**
 * Aggregate a client's projects into EGP totals (نقطة 0 formulas):
 *   Final Contract Value = contract_value - discount
 *   Remaining            = Final - SUM(payments.amount_egp)
 *   Project Profit       = Final - SUM(project expenses.amount_egp)
 */
export function computeClientFinancialSummary(
  projects: ProjectForSummary[],
): ClientFinancialSummary {
  const totalContract = sum(projects.map((p) => p.contractValue));
  const totalDiscounts = sum(projects.map((p) => p.discount));
  const totalFinal = totalContract.minus(totalDiscounts);
  const totalPaid = sum(projects.flatMap((p) => p.payments.map((x) => x.amountEgp)));
  const totalExpenses = sum(
    projects.flatMap((p) => p.expenses.map((x) => x.amountEgp)),
  );

  return {
    totalFinalContractValue: totalFinal.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    totalDiscounts: totalDiscounts.toFixed(2),
    totalRemaining: totalFinal.minus(totalPaid).toFixed(2),
    totalProjectExpenses: totalExpenses.toFixed(2),
    totalProfit: totalFinal.minus(totalExpenses).toFixed(2),
    projectCount: projects.length,
  };
}
