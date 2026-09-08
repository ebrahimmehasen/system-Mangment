"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import { CURRENCIES } from "@/lib/services/transactions";
import { PAY_TYPES, PAY_TYPE_LABELS } from "@/lib/services/payroll";
import {
  payEmployeeAction,
  type PayrollActionState,
} from "@/server/payroll-actions";

export function EmployeePaymentModal({
  employeeId,
  projects,
}: {
  employeeId: string;
  projects: { id: string; name: string }[];
}) {
  const action = payEmployeeAction.bind(null, employeeId);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PayrollActionState>({});
  const [currency, setCurrency] = useState("EGP");
  const [payType, setPayType] = useState<string>("commission");
  const [pending, startTransition] = useTransition();

  const fe = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await action(state, formData);
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
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + إضافة دفعة
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="دفعة للموظف">
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <SelectField
            id="ep-type"
            name="payType"
            label="نوع الدفعة *"
            value={payType}
            onChange={(e) => setPayType(e.target.value)}
            error={fe.payType}
          >
            {PAY_TYPES.map((t) => (
              <option key={t} value={t}>
                {PAY_TYPE_LABELS[t]}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="ep-project"
            name="projectId"
            label="المشروع (يُخصم من ميزانيته) *"
            defaultValue={state.values?.projectId ?? ""}
            error={fe.projectId}
            required
          >
            <option value="">— اختر المشروع —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="ep-amount"
              name="amountOriginal"
              label="المبلغ *"
              inputMode="decimal"
              dir="ltr"
              defaultValue={state.values?.amountOriginal ?? ""}
              error={fe.amountOriginal}
              required
            />
            <SelectField
              id="ep-currency"
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
              id="ep-rate"
              name="exchangeRateToEgp"
              label={`سعر صرف ${currency} للجنيه *`}
              inputMode="decimal"
              dir="ltr"
              defaultValue={state.values?.exchangeRateToEgp ?? ""}
              error={fe.exchangeRateToEgp}
              required
            />
          )}

          <TextField
            id="ep-date"
            name="date"
            type="date"
            label="التاريخ *"
            dir="ltr"
            defaultValue={state.values?.date || today}
            error={fe.date}
            required
          />

          <TextAreaField
            id="ep-notes"
            name="notes"
            label="ملاحظات"
            defaultValue={state.values?.notes ?? ""}
          />

          {payType === "deduction" && (
            <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-foreground-muted">
              الخصم يقلّل صافي مستحقات الموظف ولا يُسجَّل كمصروف على المشروع.
            </p>
          )}

          {state.error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <div className="mt-2 flex justify-start gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "جارٍ الحفظ…" : "حفظ الدفعة"}
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
