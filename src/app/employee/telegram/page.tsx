import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/datetime";
import { TelegramLinkCard } from "@/components/telegram/TelegramLinkCard";

export default async function EmployeeTelegramPage() {
  const user = await requireUser();
  const link = await prisma.telegramLink.findUnique({
    where: { userId: user.id },
    select: { chatId: true, linkedAt: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">ربط تيليجرام</h1>
      <TelegramLinkCard linkedAt={link?.chatId && link.linkedAt ? formatDateTime(link.linkedAt) : null} />
    </div>
  );
}
