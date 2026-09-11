"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/Field";
import {
  createClientSubmissionAction,
  type ClientSubmissionActionState,
} from "@/server/client-submission-actions";

export function ClientSubmissionForm() {
  const router = useRouter();
  const [state, setState] = useState<ClientSubmissionActionState>({});
  const [pending, startTransition] = useTransition();

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await createClientSubmissionAction(state, formData);
      setState(result);
      if (result.success) router.refresh();
    });
  }

  const fe = state.fieldErrors ?? {};
  const v = (k: string) => state.values?.[k] ?? "";

  return (
    <form
      key={state.success ? "sent" : state.fieldErrors ? JSON.stringify(state.values) : "form"}
      action={formAction}
      className="flex flex-col gap-4"
    >
      <TextField
        id="cs-name"
        name="name"
        label="اسم العميل *"
        defaultValue={v("name")}
        error={fe.name}
        required
      />
      <TextField id="cs-company" name="companyName" label="اسم الشركة" defaultValue={v("companyName")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="cs-phone" name="phone" label="الهاتف" dir="ltr" defaultValue={v("phone")} error={fe.phone} />
        <TextField id="cs-email" name="email" type="email" label="البريد الإلكتروني" dir="ltr" defaultValue={v("email")} error={fe.email} />
      </div>
      <TextField id="cs-address" name="address" label="العنوان" defaultValue={v("address")} />
      <TextAreaField id="cs-notes" name="notes" label="ملاحظات" defaultValue={v("notes")} />

      {state.error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{state.success}</p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "جارٍ الإرسال…" : "إرسال الطلب للأدمن"}
        </Button>
      </div>
    </form>
  );
}
