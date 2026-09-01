"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-md text-center">
      <h2 className="text-base font-semibold">حدث خطأ غير متوقع</h2>
      <p className="mt-2 text-sm text-foreground-muted">
        تعذّر تحميل هذه الصفحة. حاول مرة أخرى.
      </p>
      <div className="mt-4 flex justify-center">
        <Button onClick={reset}>إعادة المحاولة</Button>
      </div>
    </Card>
  );
}
