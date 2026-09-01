import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <h2 className="text-base font-semibold">غير موجود</h2>
      <p className="mt-2 text-sm text-foreground-muted">
        العنصر المطلوب غير موجود أو تم حذفه.
      </p>
      <div className="mt-4 flex justify-center">
        <Link href="/dashboard">
          <Button>العودة للوحة التحكم</Button>
        </Link>
      </div>
    </Card>
  );
}
