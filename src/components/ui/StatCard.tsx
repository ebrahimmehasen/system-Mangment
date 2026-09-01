import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const valueTone = {
    default: "text-foreground",
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-foreground-muted">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold", valueTone)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-foreground-muted">{hint}</div>}
    </div>
  );
}
