"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import {
  createPaymentAction,
  type PaymentActionState,
} from "@/server/payment-actions";
import { CURRENCIES } from "@/lib/services/transactions";

export interface ClientOption {
  id: string;
  name: string;
}
export interface ProjectOption {
  id: string;
  name: string;
  clientId: string;
}

export function PaymentFormModal({
  clients,
  projects,
  methods,
  fixedProject,
  triggerLabel = "+ تسجيل دفعة",
  triggerVariant = "primary",
}: {
  clients: ClientOption[];
  projects: ProjectOption[];
  methods: string[];
  fixedProject?: { id: string; clientId: string };
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PaymentActionState>({});
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [clientId, setClientId] = useState(fixedProject?.clientId ?? "");
  const [currency, setCurrency] = useState("EGP");

  const fe = state.fieldErrors ?? {};
  const clientProjects = useMemo(
    () => projects.filter((p) => p.clientId === clientId),
    [projects, clientId],
  );
  const today = new Date().toISOString().slice(0, 10);

  function runAction(formData: FormData) {
    startTransition(async () => {
      const result = await createPaymentAction(state, formData);
      if (result.ok) {
        setState({});
        setOpen(false);
      } else {
        setState(result);
      }
    });
  }

  function confirmOverRemaining() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    fd.set("confirmed", "1");
    runAction(fd);
  }

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="تسجيل دفعة">
        <form
          ref={formRef}
          key={
            state.needsConfirm
              ? "confirm"
              : state.fieldErrors
                ? JSON.stringify(state.values)
                : "form"
          }
          action={runAction}
          className="flex flex-col gap-4"
        >
          {fixedProject ? (
            <>
              <input type="hidden" name="clientId" value={fixedProject.clientId} />
              <input type="hidden" name="projectId" value={fixedProject.id} />
            </>
          ) : (
            <>
              <SelectField
                id="pay-client"
                name="clientId"
                label="العميل *"
                value={clientId}
                error={fe.clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">— اختر العميل —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="pay-project"
                name="projectId"
                label="المشروع *"
                defaultValue={state.values?.projectId ?? ""}
                error={fe.projectId}
                disabled={!clientId}
              >
                <option value="">— اختر المشروع —</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="pay-amount"
              name="amountOriginal"
              label="المبلغ *"
              inputMode="decimal"
              dir="ltr"
              defaultValue={state.values?.amountOriginal ?? ""}
              error={fe.amountOriginal}
              required
            />
            <SelectField
              id="pay-currency"
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
              id="pay-rate"
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
              id="pay-method"
              name="method"
              label="طريقة الدفع"
              defaultValue={state.values?.method ?? ""}
            >
              <option value="">—</option>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectField>
            <TextField
              id="pay-date"
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
            id="pay-ref"
            name="referenceNumber"
            label="رقم مرجعي"
            defaultValue={state.values?.referenceNumber ?? ""}
          />
          <TextAreaField
            id="pay-notes"
            name="notes"
            label="ملاحظات"
            defaultValue={state.values?.notes ?? ""}
          />

          {state.error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          {state.needsConfirm ? (
            <div className="rounded-md bg-warning/10 p-3 text-sm">
              <p className="text-warning">{state.needsConfirm}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={confirmOverRemaining}
                >
                  {pending ? "جارٍ الحفظ…" : "تأكيد والحفظ"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex justify-start gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "جارٍ الحفظ…" : "حفظ الدفعة"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
