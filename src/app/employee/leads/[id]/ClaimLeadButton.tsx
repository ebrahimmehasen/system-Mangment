"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { claimTargetClientAction } from "@/server/target-client-actions";

export function ClaimLeadButton({ targetClientId }: { targetClientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClaim() {
    setError(null);
    startTransition(async () => {
      const res = await claimTargetClientAction(targetClientId);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={onClaim} disabled={pending}>
        {pending ? "جارٍ التعيين…" : "اشتغل على العميل ده"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
