"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import type { ProjectActionState } from "@/server/project-actions";

export interface ProjectDefaults {
  clientId?: string;
  name?: string;
  description?: string | null;
  status?: string;
  startDate?: string | null;
  expectedDeliveryDate?: string | null;
  contractValue?: string;
  discount?: string;
  notes?: string | null;
}

export function ProjectFormModal({
  mode,
  action,
  clients,
  statuses,
  project,
  triggerLabel,
  triggerVariant = "primary",
}: {
  mode: "create" | "edit";
  action: (
    prev: ProjectActionState,
    formData: FormData,
  ) => Promise<ProjectActionState>;
  clients: { id: string; name: string }[];
  statuses: string[];
  project?: ProjectDefaults;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ProjectActionState, FormData>(
    action,
    {},
  );

  const v = (k: keyof ProjectDefaults) =>
    (state.values?.[k] as string | undefined) ??
    (project?.[k] as string | null | undefined) ??
    "";

  const fe = state.fieldErrors ?? {};

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "مشروع جديد" : "تعديل المشروع"}
      >
        {/* remount on each action result so fields repopulate from state.values */}
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <SelectField
            id="clientId"
            name="clientId"
            label="العميل *"
            defaultValue={v("clientId")}
            error={fe.clientId}
            required
          >
            <option value="">— اختر العميل —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>

          <TextField
            id="name"
            name="name"
            label="اسم المشروع *"
            defaultValue={v("name")}
            error={fe.name}
            required
          />

          <TextAreaField
            id="description"
            name="description"
            label="الوصف"
            defaultValue={v("description")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="contractValue"
              name="contractValue"
              label="قيمة العقد (ج.م)"
              inputMode="decimal"
              dir="ltr"
              defaultValue={v("contractValue") || "0"}
              error={fe.contractValue}
            />
            <TextField
              id="discount"
              name="discount"
              label="الخصم (ج.م)"
              inputMode="decimal"
              dir="ltr"
              defaultValue={v("discount") || "0"}
              error={fe.discount}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="startDate"
              name="startDate"
              type="date"
              label="تاريخ البداية"
              dir="ltr"
              defaultValue={v("startDate")}
            />
            <TextField
              id="expectedDeliveryDate"
              name="expectedDeliveryDate"
              type="date"
              label="تاريخ التسليم المتوقع"
              dir="ltr"
              defaultValue={v("expectedDeliveryDate")}
              error={fe.expectedDeliveryDate}
            />
          </div>

          <SelectField
            id="status"
            name="status"
            label="الحالة *"
            defaultValue={v("status") || statuses[0] || ""}
            error={fe.status}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>

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
