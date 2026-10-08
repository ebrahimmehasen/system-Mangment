/** Read-only priority pill: 1 = most important (red) … 99 = least (muted). Renders nothing for "no priority". */
export function priorityTone(priority: number): { label: string; cls: string } {
  if (priority <= 5) return { label: "عاجلة", cls: "border-danger/40 bg-danger/15 text-danger" };
  if (priority <= 20) return { label: "عالية", cls: "border-warning/40 bg-warning/15 text-warning" };
  if (priority <= 50) return { label: "متوسطة", cls: "border-accent/40 bg-accent/15 text-accent" };
  return { label: "منخفضة", cls: "border-border bg-surface text-foreground-muted" };
}

export function TaskPriorityBadge({ priority, showLabel = false }: { priority: number; showLabel?: boolean }) {
  if (priority <= 0) return null;
  const tone = priorityTone(priority);
  return (
    <span
      title={`الأولوية ${priority} (1 = الأهم)`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${tone.cls}`}
    >
      <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3 fill-current">
        <path d="M3 1.5a.75.75 0 0 1 1.5 0v.3l7.2 2.4a.75.75 0 0 1 0 1.42L4.5 8.02V14.5a.75.75 0 0 1-1.5 0v-13Z" />
      </svg>
      {priority}
      {showLabel && <span className="font-medium">· {tone.label}</span>}
    </span>
  );
}
