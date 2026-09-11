"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField } from "@/components/ui/Field";
import { addTargetClientActivityAction } from "@/server/target-client-actions";

export function TargetClientActivityForm({ targetClientId }: { targetClientId: string }) {
  const action = addTargetClientActivityAction.bind(null, targetClientId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function formAction(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await action({}, formData);
      if (res?.error) setError(res.error);
      else formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <SelectField id="tca-kind" name="kind" label="النوع" defaultValue="note">
          <option value="note">ملاحظة</option>
          <option value="report">تقرير</option>
        </SelectField>
        <TextAreaField id="tca-body" name="body" label="النص" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="tca-file" className="text-sm text-foreground-muted">
          مرفق (PDF / DOC / DOCX — اختياري)
        </label>
        <input
          id="tca-file"
          type="file"
          name="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="text-sm text-foreground-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-surface"
        />
      </div>

      {error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "جارٍ الإضافة…" : "إضافة للتايم لاين"}
        </Button>
      </div>
    </form>
  );
}
