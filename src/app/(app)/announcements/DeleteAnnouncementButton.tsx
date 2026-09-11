"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deleteAnnouncementAction } from "@/server/announcement-actions";

export function DeleteAnnouncementButton({ announcementId }: { announcementId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteAnnouncementAction(announcementId);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="ghost" onClick={onDelete} disabled={pending} className="text-danger">
        {pending ? "جارٍ الحذف…" : "حذف"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
