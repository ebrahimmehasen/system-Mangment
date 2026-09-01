"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import {
  MAX_PRESETS_PER_USER,
  MAX_PRESET_NAME,
  pickPresetFilters,
  coercePresetFilters,
  presetFiltersToQuery,
  PRESET_FILTER_KEYS,
} from "@/lib/reports/presets";

export interface PresetActionState {
  ok?: boolean;
  error?: string;
}

/** Save (or overwrite) a named preset from the current /reports filters. */
export async function savePresetAction(
  _prev: PresetActionState,
  formData: FormData,
): Promise<PresetActionState> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "أدخل اسمًا للإعداد." };
  if (name.length > MAX_PRESET_NAME) return { error: "الاسم طويل جدًا." };

  const raw: Record<string, string> = {};
  for (const k of PRESET_FILTER_KEYS) {
    const v = formData.get(k);
    if (typeof v === "string" && v.trim()) raw[k] = v.trim();
  }
  const filters = pickPresetFilters(raw);

  const existing = await prisma.reportPreset.findUnique({
    where: { userId_name: { userId: user.id, name } },
    select: { id: true },
  });

  if (!existing) {
    const count = await prisma.reportPreset.count({ where: { userId: user.id } });
    if (count >= MAX_PRESETS_PER_USER) {
      return { error: `الحد الأقصى ${MAX_PRESETS_PER_USER} إعدادًا محفوظًا.` };
    }
  }

  await prisma.reportPreset.upsert({
    where: { userId_name: { userId: user.id, name } },
    create: { userId: user.id, name, filters, lastUsedAt: new Date() },
    update: { filters, lastUsedAt: new Date() },
  });

  revalidatePath("/reports");
  revalidatePath("/reports/center");
  return { ok: true };
}

export async function deletePresetAction(
  _prev: PresetActionState,
  formData: FormData,
): Promise<PresetActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "معرّف غير صالح." };

  await prisma.reportPreset.deleteMany({ where: { id, userId: user.id } });

  revalidatePath("/reports");
  revalidatePath("/reports/center");
  return { ok: true };
}

/** Delete a preset from a plain <form action> (reports center). */
export async function deletePresetFormAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await prisma.reportPreset.deleteMany({ where: { id, userId: user.id } });
    revalidatePath("/reports");
    revalidatePath("/reports/center");
  }
}

/** Bump lastUsedAt without navigating (called from the client PresetsBar). */
export async function touchPresetAction(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.reportPreset.updateMany({
    where: { id, userId: user.id },
    data: { lastUsedAt: new Date() },
  });
  revalidatePath("/reports/center");
}

/** Mark a preset as just-used and navigate to /reports with its filters. */
export async function applyPresetAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const preset = await prisma.reportPreset.findFirst({
    where: { id, userId: user.id },
    select: { filters: true },
  });
  if (!preset) redirect("/reports");

  await prisma.reportPreset.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });

  const qs = presetFiltersToQuery(coercePresetFilters(preset.filters));
  redirect(qs ? `/reports?${qs}` : "/reports");
}
