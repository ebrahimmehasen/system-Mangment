"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import { COMPANY_SIZE_OPTIONS, COMPANY_SIZE_OTHER } from "@/lib/services/target-clients";
import type { TargetClientActionState } from "@/server/target-client-actions";

export interface TargetClientDefaults {
  companyName?: string;
  phones?: string;
  facebook?: string;
  instagram?: string;
  whatsapp?: string;
  website?: string | null;
  companySize?: string | null;
  script?: string | null;
  notes?: string | null;
}

export function TargetClientFormModal({
  mode,
  action,
  targetClient,
  triggerLabel,
  triggerVariant = "primary",
}: {
  mode: "create" | "edit";
  action: (
    prev: TargetClientActionState,
    formData: FormData,
  ) => Promise<TargetClientActionState>;
  targetClient?: TargetClientDefaults;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    TargetClientActionState,
    FormData
  >(action, {});

  const v = (k: keyof TargetClientDefaults) =>
    (state.values?.[k] as string | undefined) ??
    (targetClient?.[k] != null ? String(targetClient[k]) : "") ??
    "";

  const knownSize = (COMPANY_SIZE_OPTIONS as readonly string[]).includes(v("companySize"));
  const [sizeChoice, setSizeChoice] = useState(
    v("companySize") ? (knownSize ? v("companySize") : COMPANY_SIZE_OTHER) : "",
  );

  const fe = state.fieldErrors ?? {};

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "عميل مستهدف جديد" : "تعديل العميل المستهدف"}
        className="max-w-2xl"
      >
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <TextField
            id="companyName"
            name="companyName"
            label="اسم الشركة *"
            defaultValue={v("companyName")}
            error={fe.companyName}
            required
          />

          <TextAreaField
            id="phones"
            name="phones"
            label="أرقام التواصل (رقم في كل سطر أو مفصولة بفاصلة)"
            dir="ltr"
            defaultValue={v("phones")}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="facebook"
              name="facebook"
              label="فيسبوك"
              dir="ltr"
              defaultValue={v("facebook")}
            />
            <TextField
              id="instagram"
              name="instagram"
              label="إنستجرام"
              dir="ltr"
              defaultValue={v("instagram")}
            />
            <TextField
              id="whatsapp"
              name="whatsapp"
              label="واتساب"
              dir="ltr"
              defaultValue={v("whatsapp")}
            />
          </div>

          <TextField
            id="website"
            name="website"
            label="الموقع الإلكتروني"
            dir="ltr"
            defaultValue={v("website")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="companySize"
              name="companySize"
              label="حجم الشركة"
              value={sizeChoice}
              onChange={(e) => setSizeChoice(e.target.value)}
            >
              <option value="">— غير محدد —</option>
              {COMPANY_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value={COMPANY_SIZE_OTHER}>{COMPANY_SIZE_OTHER}</option>
            </SelectField>
            {sizeChoice === COMPANY_SIZE_OTHER && (
              <TextField
                id="companySizeOther"
                name="companySizeOther"
                label="حدد حجم الشركة"
                defaultValue={knownSize ? "" : v("companySize")}
                error={fe.companySizeOther}
              />
            )}
          </div>

          <TextAreaField
            id="script"
            name="script"
            label="سكربت التعامل مع العميل"
            defaultValue={v("script")}
          />
          <TextAreaField
            id="notes"
            name="notes"
            label="ملاحظات"
            defaultValue={v("notes")}
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
