"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deleteTargetClientActivityAction } from "@/server/target-client-actions";

export function DeleteActivityButton({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteTargetClientActivityAction(activityId);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="ghost" onClick={onDelete} disabled={pending} className="!px-2 !py-1 text-xs">
        {pending ? "جارٍ الحذف…" : "حذف"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
