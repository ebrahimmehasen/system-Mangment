"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createTelegramLinkAction, unlinkTelegramAction } from "@/server/telegram-actions";

export function TelegramLinkCard({ linkedAt }: { linkedAt: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function createLink() {
    setError(null);
    startTransition(async () => {
      const res = await createTelegramLinkAction();
      if (res.error) setError(res.error);
      else {
        setUrl(res.url ?? null);
        setMinutes(res.expiresInMinutes ?? 10);
      }
    });
  }

  function unlink() {
    startTransition(async () => {
      await unlinkTelegramAction();
      setUrl(null);
      router.refresh();
    });
  }

  return (
    <Card className="flex max-w-xl flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">بوت تيليجرام</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          اربط حسابك لتشوف مواعيدك وتذكيراتك ومهامك من تيليجرام، وتوصلك رسالة كل صباح. البوت للعرض فقط.
        </p>
      </div>

      {linkedAt ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-success">✓ مربوط من {linkedAt}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={createLink} disabled={pending}>
              إعادة الربط بمحادثة تانية
            </Button>
            <Button variant="danger" onClick={unlink} disabled={pending}>
              فصل
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button onClick={createLink} disabled={pending}>
            {pending ? "جارٍ الإنشاء…" : "إنشاء رابط الربط"}
          </Button>
        </div>
      )}

      {url && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3 text-sm">
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
            افتح تيليجرام واضغط Start ←
          </a>
          <p className="text-xs text-foreground-muted">
            الرابط لمرة واحدة وصالح {minutes} دقايق. بعد ما تربط، حدّث الصفحة.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}
