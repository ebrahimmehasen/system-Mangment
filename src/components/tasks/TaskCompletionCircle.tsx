"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleTaskCompleteAction } from "@/server/task-actions";

export function TaskCompletionCircle({ taskId, done }: { taskId: string; done: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await toggleTaskCompleteAction(taskId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={done ? "إعادة فتح المهمة" : "إتمام المهمة"}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50 ${
        done
          ? "border-success bg-success text-white"
          : "border-border hover:border-accent"
      }`}
    >
      {done && (
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
          <path
            d="M2 6.5L4.5 9L10 3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
