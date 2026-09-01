"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import {
  uploadProjectFileAction,
  type FileActionState,
} from "@/server/file-actions";

export function FileUploader({ projectId }: { projectId: string }) {
  const action = uploadProjectFileAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState<FileActionState, FormData>(
    action,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="application/pdf,.pdf"
          required
          className="text-sm text-foreground-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-surface"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "جارٍ الرفع…" : "+ رفع ملف"}
        </Button>
      </div>

      {pending && (
        <div className="h-1 w-full overflow-hidden rounded bg-surface-2">
          <div className="h-full w-1/3 animate-pulse rounded bg-accent" />
        </div>
      )}
      {state.error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          {state.success}
        </p>
      )}
      <p className="text-xs text-foreground-muted">
        PDF فقط، بحد أقصى 10 ميجابايت.
      </p>
    </form>
  );
}
