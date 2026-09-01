"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import {
  createExpenseAction,
  type ExpenseActionState,
} from "@/server/expense-actions";
import { CURRENCIES } from "@/lib/services/transactions";

export function ExpenseFormModal({
  categories,
  projects,
  methods,
  fixedProject,
  triggerLabel = "+ مصروف جديد",
  triggerVariant = "primary",
}: {
  categories: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  methods: string[];
  fixedProject?: { id: string };
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ExpenseActionState>({});
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState<"project" | "company">(
    fixedProject ? "project" : "company",
  );
  const [currency, setCurrency] = useState("EGP");

  const fe = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await createExpenseAction(state, formData);
      if (result.ok) {
        setState({});
        setOpen(false);
      } else {
        setState(result);
      }
    });
  }

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="تسجيل مصروف">
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          {fixedProject ? (
            <>
              <input type="hidden" name="type" value="project" />
              <input type="hidden" name="projectId" value={fixedProject.id} />
            </>
          ) : (
            <>
              <SelectField
                id="exp-type"
                name="type"
                label="نوع المصروف *"
                value={type}
                onChange={(e) => setType(e.target.value as "project" | "company")}
              >
                <option value="company">مصروف شركة</option>
                <option value="project">مصروف مشروع</option>
              </SelectField>
              {type === "project" && (
                <SelectField
                  id="exp-project"
                  name="projectId"
                  label="المشروع *"
                  defaultValue={state.values?.projectId ?? ""}
                  error={fe.projectId}
                >
                  <option value="">— اختر المشروع —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </SelectField>
              )}
            </>
          )}

          <SelectField
            id="exp-category"
            name="categoryId"
            label="التصنيف *"
            defaultValue={state.values?.categoryId ?? ""}
            error={fe.categoryId}
            required
          >
            <option value="">— اختر التصنيف —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="exp-amount"
              name="amountOriginal"
              label="المبلغ *"
              inputMode="decimal"
              dir="ltr"
              defaultValue={state.values?.amountOriginal ?? ""}
              error={fe.amountOriginal}
              required
            />
            <SelectField
              id="exp-currency"
              name="currency"
              label="العملة *"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
          </div>

          {currency !== "EGP" && (
            <TextField
              id="exp-rate"
              name="exchangeRateToEgp"
              label={`سعر صرف ${currency} للجنيه *`}
              inputMode="decimal"
              dir="ltr"
              defaultValue={state.values?.exchangeRateToEgp ?? ""}
              error={fe.exchangeRateToEgp}
              required
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="exp-method"
              name="paymentMethod"
              label="طريقة الدفع"
              defaultValue={state.values?.paymentMethod ?? ""}
            >
              <option value="">—</option>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectField>
            <TextField
              id="exp-date"
              name="date"
              type="date"
              label="التاريخ *"
              dir="ltr"
              defaultValue={state.values?.date || today}
              error={fe.date}
              required
            />
          </div>

          <TextField
            id="exp-desc"
            name="description"
            label="الوصف"
            defaultValue={state.values?.description ?? ""}
          />
          <TextAreaField
            id="exp-notes"
            name="notes"
            label="ملاحظات"
            defaultValue={state.values?.notes ?? ""}
          />

          {state.error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <div className="mt-2 flex justify-start gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "جارٍ الحفظ…" : "حفظ المصروف"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
