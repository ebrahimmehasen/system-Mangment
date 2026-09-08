"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import { CURRENCIES } from "@/lib/services/transactions";
import {
  depositToCompanyAccountAction,
  withdrawFromCompanyAccountAction,
  type CompanyAccountActionState,
} from "@/server/company-account-actions";

export function CompanyAccountForms() {
  return (
    <div className="flex flex-wrap gap-2">
      <EntryModal
        direction="deposit"
        action={depositToCompanyAccountAction}
        triggerLabel="+ إيداع"
        triggerVariant="primary"
      />
      <EntryModal
        direction="withdrawal"
        action={withdrawFromCompanyAccountAction}
        triggerLabel="− سحب"
        triggerVariant="secondary"
      />
    </div>
  );
}

function EntryModal({
  direction,
  action,
  triggerLabel,
  triggerVariant,
}: {
  direction: "deposit" | "withdrawal";
  action: (
    prev: CompanyAccountActionState,
    formData: FormData,
  ) => Promise<CompanyAccountActionState>;
  triggerLabel: string;
  triggerVariant: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CompanyAccountActionState>({});
  const [currency, setCurrency] = useState("EGP");
  const [pending, startTransition] = useTransition();

  const fe = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);
  const title = direction === "deposit" ? "إيداع في حساب الشركة" : "سحب من حساب الشركة";

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
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="ca-amount"
              name="amountOriginal"
              label="المبلغ *"
              inputMode="decimal"
              dir="ltr"
              defaultValue={state.values?.amountOriginal ?? ""}
              error={fe.amountOriginal}
              required
            />
            <SelectField
              id="ca-currency"
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
              id="ca-rate"
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
            id="ca-date"
            name="date"
            type="date"
            label="التاريخ *"
            dir="ltr"
            defaultValue={state.values?.date || today}
            error={fe.date}
            required
          />

          <TextAreaField
            id="ca-reason"
            name="reason"
            label="السبب / البيان"
            defaultValue={state.values?.reason ?? ""}
          />

          {state.error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <div className="mt-2 flex justify-start gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "جارٍ الحفظ…" : "حفظ"}
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
