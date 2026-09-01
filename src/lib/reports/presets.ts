import { resolveDateRange } from "@/lib/services/reports";

/** Search-param keys that make up a saved report filter. */
export const PRESET_FILTER_KEYS = [
  "range",
  "from",
  "to",
  "csort",
  "cdir",
  "psort",
  "pdir",
  "pq",
] as const;

export type PresetFilterKey = (typeof PRESET_FILTER_KEYS)[number];
export type PresetFilters = Partial<Record<PresetFilterKey, string>>;

export const MAX_PRESETS_PER_USER = 30;
export const MAX_PRESET_NAME = 60;

/** Keep only the known, non-empty filter keys from a search-param bag. */
export function pickPresetFilters(
  sp: Record<string, string | string[] | undefined>,
): PresetFilters {
  const out: PresetFilters = {};
  for (const k of PRESET_FILTER_KEYS) {
    const v = sp[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

/** Parse a stored JSON `filters` value back into a clean PresetFilters. */
export function coercePresetFilters(value: unknown): PresetFilters {
  if (!value || typeof value !== "object") return {};
  return pickPresetFilters(value as Record<string, string | undefined>);
}

export function presetFiltersToQuery(f: PresetFilters): string {
  const q = new URLSearchParams();
  for (const k of PRESET_FILTER_KEYS) {
    const v = f[k];
    if (v) q.set(k, v);
  }
  return q.toString();
}

/** Short Arabic summary of what a preset filters to. */
export function describeFilters(f: PresetFilters): string {
  const parts: string[] = [];
  const range = resolveDateRange(f);
  parts.push(range.label);
  if (f.pq) parts.push(`بحث: ${f.pq}`);
  if (f.csort) parts.push("ترتيب العملاء مخصّص");
  if (f.psort) parts.push("ترتيب الربحية مخصّص");
  return parts.join(" · ");
}
