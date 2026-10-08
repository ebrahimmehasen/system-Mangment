import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { ymdInTz, zonedInputToUtc } from "@/lib/datetime";
import { compareTasks, lateSinceYmd, shiftYmd } from "@/lib/services/tasks";
import {
  formatDigest,
  formatMeetings,
  formatReminders,
  formatTasks,
  parseBotCommand,
  type BotMeeting,
  type BotReminder,
  type BotTask,
} from "@/lib/services/telegram-format";

export const LINK_CODE_TTL_MINUTES = 10;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const WEEK_DAYS = 7;

export const hashLinkCode = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest("hex");

export function generateLinkCode(): string {
  return Array.from(randomBytes(10), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

const dayStart = (ymd: string) => zonedInputToUtc(`${ymd}T00:00`)!;
const dayEnd = (ymd: string) => zonedInputToUtc(`${ymd}T23:59`)!;
const mine = (userId: string) => [{ createdBy: userId }, { assignedToUserId: userId }];

async function meetingsFor(userId: string, fromYmd: string, toYmd: string): Promise<BotMeeting[]> {
  return prisma.meeting.findMany({
    where: { status: "scheduled", OR: mine(userId), meetingAt: { gte: dayStart(fromYmd), lte: dayEnd(toYmd) } },
    orderBy: { meetingAt: "asc" },
    select: { title: true, meetingAt: true, location: true },
  });
}

async function remindersFor(userId: string, toYmd: string): Promise<BotReminder[]> {
  return prisma.reminder.findMany({
    where: { doneAt: null, OR: mine(userId), remindAt: { lte: dayEnd(toYmd) } },
    orderBy: { remindAt: "asc" },
    select: { title: true, remindAt: true },
  });
}

async function tasksFor(userId: string, todayYmd: string, toYmd: string): Promise<BotTask[]> {
  const rows = await prisma.task.findMany({
    where: {
      status: { not: "done" },
      assignees: { some: { userId } },
      dueDate: { lte: dayEnd(toYmd) },
    },
    select: { title: true, priority: true, dueDate: true, status: true, overdueSince: true },
  });
  return rows
    .map((r) => ({ ...r, id: r.title }))
    .sort(compareTasks)
    .map((r) => ({
      title: r.title,
      priority: r.priority,
      dueDate: r.dueDate,
      lateSince: lateSinceYmd(r, todayYmd),
    }));
}

/** Everything due today (meetings, open reminders incl. late ones, open tasks incl. late ones) as the morning/“today” message. "" if empty. */
export async function buildDigest(userId: string, name: string | null): Promise<string> {
  const todayYmd = ymdInTz(new Date());
  const [meetings, reminders, tasks] = await Promise.all([
    meetingsFor(userId, todayYmd, todayYmd),
    remindersFor(userId, todayYmd),
    tasksFor(userId, todayYmd, todayYmd),
  ]);
  return formatDigest({ name, todayYmd, meetings, reminders, tasks });
}

const HELP = [
  "<b>أوامر البوت</b>",
  "/today — مواعيد وتذكيرات ومهام اليوم",
  "/meetings — المواعيد القادمة",
  "/reminders — التذكيرات المفتوحة",
  "/tasks — المهام المفتوحة",
  "/unlink — فصل الحساب",
].join("\n");

const NOT_LINKED =
  "الحساب ده مش مربوط. ادخل على النظام ← صفحة «ربط تيليجرام» واضغط على رابط الربط.";

/** Handles one private-chat message and returns the HTML reply. */
export async function handleBotMessage(chatId: string, text: string): Promise<string> {
  const { command, arg } = parseBotCommand(text);

  if (command === "start" && arg) return linkChat(chatId, arg);

  const link = await prisma.telegramLink.findUnique({
    where: { chatId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!link) return command === "help" ? HELP : NOT_LINKED;

  const userId = link.user.id;
  const todayYmd = ymdInTz(new Date());

  switch (command) {
    case "today": {
      const digest = await buildDigest(userId, link.user.name);
      return digest || "مفيش حاجة النهارده 🎉";
    }
    case "meetings":
      return formatMeetings(await meetingsFor(userId, todayYmd, shiftYmd(todayYmd, WEEK_DAYS)), todayYmd);
    case "reminders":
      return formatReminders(await remindersFor(userId, shiftYmd(todayYmd, 14)), todayYmd);
    case "tasks":
      return formatTasks(await tasksFor(userId, todayYmd, shiftYmd(todayYmd, WEEK_DAYS)));
    case "unlink":
      await prisma.telegramLink.update({
        where: { userId },
        data: { chatId: null, linkedAt: null, codeHash: null, codeExpiresAt: null },
      });
      return "تم فصل الحساب. تقدر تربطه تاني من النظام.";
    default:
      return HELP;
  }
}

async function linkChat(chatId: string, code: string): Promise<string> {
  const pending = await prisma.telegramLink.findFirst({
    where: { codeHash: hashLinkCode(code), codeExpiresAt: { gt: new Date() } },
  });
  if (!pending) return "كود الربط غير صحيح أو انتهت صلاحيته. اطلب رابط جديد من النظام.";

  const taken = await prisma.telegramLink.findUnique({ where: { chatId } });
  if (taken && taken.userId !== pending.userId) {
    return "المحادثة دي مربوطة بحساب تاني. ابعت /unlink الأول من الحساب القديم.";
  }

  await prisma.telegramLink.update({
    where: { id: pending.id },
    data: { chatId, linkedAt: new Date(), codeHash: null, codeExpiresAt: null },
  });
  return "تم الربط ✅\nابعت /today لشوف مواعيدك وتذكيراتك ومهامك، و/help لباقي الأوامر.\nهتوصلك رسالة كل صباح.";
}

