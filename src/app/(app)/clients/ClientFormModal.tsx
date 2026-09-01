"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import type { ClientActionState } from "@/server/client-actions";

export interface ClientDefaults {
  name?: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: string;
}

export function ClientFormModal({
  mode,
  action,
  client,
  triggerLabel,
  triggerVariant = "primary",
}: {
  mode: "create" | "edit";
  action: (
    prev: ClientActionState,
    formData: FormData,
  ) => Promise<ClientActionState>;
  client?: ClientDefaults;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ClientActionState, FormData>(
    action,
    {},
  );

  const v = (k: keyof ClientDefaults) =>
    (state.values?.[k] as string | undefined) ??
    (client?.[k] as string | null | undefined) ??
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
        title={mode === "create" ? "عميل جديد" : "تعديل بيانات العميل"}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <TextField
            id="name"
            name="name"
            label="اسم العميل *"
            defaultValue={v("name")}
            error={fe.name}
            required
          />
          <TextField
            id="companyName"
            name="companyName"
            label="اسم الشركة"
            defaultValue={v("companyName")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="phone"
              name="phone"
              label="الهاتف"
              dir="ltr"
              defaultValue={v("phone")}
              error={fe.phone}
            />
            <TextField
              id="email"
              name="email"
              type="email"
              label="البريد الإلكتروني"
              dir="ltr"
              defaultValue={v("email")}
              error={fe.email}
            />
          </div>
          <TextField
            id="address"
            name="address"
            label="العنوان"
            defaultValue={v("address")}
          />
          <TextAreaField
            id="notes"
            name="notes"
            label="ملاحظات"
            defaultValue={v("notes")}
          />
          <SelectField
            id="status"
            name="status"
            label="الحالة"
            defaultValue={v("status") || "active"}
          >
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </SelectField>

          {state.error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <div className="mt-2 flex justify-start gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
