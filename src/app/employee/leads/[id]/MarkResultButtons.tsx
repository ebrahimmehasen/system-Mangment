"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { markTargetClientResultAction } from "@/server/target-client-actions";

export function MarkResultButtons({ targetClientId }: { targetClientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function mark(result: "won" | "lost") {
    setError(null);
    startTransition(async () => {
      const res = await markTargetClientResultAction(targetClientId, result);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button onClick={() => mark("won")} disabled={pending}>
          نجح الديل
        </Button>
        <Button variant="danger" onClick={() => mark("lost")} disabled={pending}>
          فشل الديل
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-foreground-muted">
        لو الديل فشل، العميل هيفضل معلّم عليك لحد ما الأدمن يفك التعيين.
      </p>
    </div>
  );
}
