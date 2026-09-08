"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import type { EmployeeActionState } from "@/server/employee-actions";

export interface EmployeeDefaults {
  name?: string;
  age?: number | null;
  country?: string | null;
  governorate?: string | null;
  phone?: string | null;
  qualification?: string | null;
  notes?: string | null;
  status?: string;
  cvFileName?: string | null;
}

export function EmployeeFormModal({
  mode,
  action,
  employee,
  triggerLabel,
  triggerVariant = "primary",
}: {
  mode: "create" | "edit";
  action: (
    prev: EmployeeActionState,
    formData: FormData,
  ) => Promise<EmployeeActionState>;
  employee?: EmployeeDefaults;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    EmployeeActionState,
    FormData
  >(action, {});

  const v = (k: keyof EmployeeDefaults) =>
    (state.values?.[k] as string | undefined) ??
    (employee?.[k] != null ? String(employee[k]) : "") ??
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
        title={mode === "create" ? "موظف جديد" : "تعديل بيانات الموظف"}
      >
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <TextField
            id="name"
            name="name"
            label="اسم الموظف *"
            defaultValue={v("name")}
            error={fe.name}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="age"
              name="age"
              type="number"
              min={16}
              max={99}
              label="العمر"
              dir="ltr"
              defaultValue={v("age")}
              error={fe.age}
            />
            <TextField
              id="phone"
              name="phone"
              label="الهاتف"
              dir="ltr"
              defaultValue={v("phone")}
              error={fe.phone}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="country"
              name="country"
              label="الدولة"
              defaultValue={v("country")}
            />
            <TextField
              id="governorate"
              name="governorate"
              label="المحافظة"
              defaultValue={v("governorate")}
            />
          </div>
          <TextField
            id="qualification"
            name="qualification"
            label="المؤهل / الوظيفة"
            defaultValue={v("qualification")}
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
            <option value="inactive">مؤرشف</option>
          </SelectField>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cv" className="text-sm text-foreground-muted">
              السيرة الذاتية (PDF / DOC / DOCX — بحد أقصى 10 ميجابايت)
            </label>
            <input
              id="cv"
              type="file"
              name="cv"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="text-sm text-foreground-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-surface"
            />
            {mode === "edit" && employee?.cvFileName && (
              <p className="text-xs text-foreground-muted">
                الحالي: {employee.cvFileName} — سيُستبدل عند اختيار ملف جديد.
              </p>
            )}
          </div>

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
