import { Prisma } from "@prisma/client";
import { sum, toDecimal } from "@/lib/money";

// ─────────────────────────── Validation ───────────────────────────

export interface ProjectFormValues {
  clientId: string;
  name: string;
  description: string;
  status: string;
  startDate: string; // yyyy-mm-dd or ""
  expectedDeliveryDate: string;
  contractValue: string;
  discount: string;
  notes: string;
}

export type ProjectFieldErrors = Partial<
  Record<keyof ProjectFormValues, string>
>;

function parseAmount(raw: string): { value: Prisma.Decimal | null; error?: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: new Prisma.Decimal(0) };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { value: null, error: "أدخل رقمًا صحيحًا (حتى منزلتين عشريتين)." };
  }
  return { value: new Prisma.Decimal(trimmed) };
}

export function parseProjectForm(formData: FormData): {
  values: ProjectFormValues;
  errors: ProjectFieldErrors;
  parsed: {
    contractValue: Prisma.Decimal;
    discount: Prisma.Decimal;
    startDate: Date | null;
    expectedDeliveryDate: Date | null;
  };
} {
  const values: ProjectFormValues = {
    clientId: String(formData.get("clientId") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    status: String(formData.get("status") ?? "").trim(),
    startDate: String(formData.get("startDate") ?? "").trim(),
    expectedDeliveryDate: String(formData.get("expectedDeliveryDate") ?? "").trim(),
    contractValue: String(formData.get("contractValue") ?? "").trim(),
    discount: String(formData.get("discount") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };

  const errors: ProjectFieldErrors = {};

  if (!values.clientId) errors.clientId = "اختر العميل.";
  if (!values.name) errors.name = "اسم المشروع مطلوب.";
  if (!values.status) errors.status = "اختر حالة المشروع.";

  const cv = parseAmount(values.contractValue);
  if (cv.error) errors.contractValue = cv.error;
  const dc = parseAmount(values.discount);
  if (dc.error) errors.discount = dc.error;

  const contractValue = cv.value ?? new Prisma.Decimal(0);
  const discount = dc.value ?? new Prisma.Decimal(0);

  if (!cv.error && !dc.error && discount.greaterThan(contractValue)) {
    errors.discount = "الخصم لا يمكن أن يتجاوز قيمة العقد.";
  }

  const startDate = values.startDate ? new Date(values.startDate) : null;
  const expectedDeliveryDate = values.expectedDeliveryDate
    ? new Date(values.expectedDeliveryDate)
    : null;

  if (
    startDate &&
    expectedDeliveryDate &&
    expectedDeliveryDate.getTime() < startDate.getTime()
  ) {
    errors.expectedDeliveryDate =
      "تاريخ التسليم المتوقع لا يمكن أن يسبق تاريخ البداية.";
  }

  return {
    values,
    errors,
    parsed: { contractValue, discount, startDate, expectedDeliveryDate },
  };
}

// ─────────────────────── Financial summary ────────────────────────

export interface ProjectFinancials {
  contractValue: string;
  discount: string;
  finalContractValue: string;
  paid: string;
  remaining: string;
  projectExpenses: string;
  profit: string;
}

interface ProjectForFinancials {
  contractValue: Prisma.Decimal;
  discount: Prisma.Decimal;
  payments: { amountEgp: Prisma.Decimal }[];
  expenses: { amountEgp: Prisma.Decimal }[];
}

/**
 * نقطة 0 formulas, all EGP, decimal-safe:
 *   Final Contract Value = Contract Value - Discount
 *   Remaining            = Final - SUM(Payments.amount_egp)
 *   Project Profit       = Final - SUM(Project Expenses.amount_egp)
 * (`expenses` passed in must already be filtered to type = project.)
 */
export function computeProjectFinancials(
  project: ProjectForFinancials,
): ProjectFinancials {
  const contractValue = toDecimal(project.contractValue);
  const discount = toDecimal(project.discount);
  const final = contractValue.minus(discount);
  const paid = sum(project.payments.map((p) => p.amountEgp));
  const projectExpenses = sum(project.expenses.map((e) => e.amountEgp));

  return {
    contractValue: contractValue.toFixed(2),
    discount: discount.toFixed(2),
    finalContractValue: final.toFixed(2),
    paid: paid.toFixed(2),
    remaining: final.minus(paid).toFixed(2),
    projectExpenses: projectExpenses.toFixed(2),
    profit: final.minus(projectExpenses).toFixed(2),
  };
}
