"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction } from "@/server/task-actions";

/** Inline "+ إضافة مهمة" under a board column — creates a task due that day, assigned to me. */
export function QuickAddTask({ dueDateLocal }: { dueDateLocal?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  function submit() {
    if (submittedRef.current) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    submittedRef.current = true;
    const formData = new FormData();
    formData.set("title", trimmed);
    if (dueDateLocal) formData.set("dueDate", dueDateLocal);
    startTransition(async () => {
      await createTaskAction({}, formData);
      setTitle("");
      setEditing(false);
      submittedRef.current = false;
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="w-full rounded-md px-2 py-1.5 text-right text-xs text-foreground-muted hover:bg-surface-2 hover:text-foreground"
      >
        + إضافة مهمة
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={title}
      disabled={pending}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") {
          setTitle("");
          setEditing(false);
        }
      }}
      onBlur={submit}
      placeholder="عنوان المهمة…"
      className="w-full rounded-md border border-accent bg-surface-2 px-2 py-1.5 text-xs text-foreground focus:outline-none disabled:opacity-50"
    />
  );
}
