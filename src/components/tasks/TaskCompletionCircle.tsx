"use client";

/** Dumb/presentational — TaskCard owns the optimistic pending state and click handler. */
export function TaskCompletionCircle({
  done,
  onClick,
  disabled,
  title,
}: {
  done: boolean;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={done ? "إعادة فتح المهمة" : "إتمام المهمة"}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50 ${disabled ? "cursor-not-allowed" : ""} ${
        done ? "border-success bg-success text-white" : "border-border hover:border-accent"
      }`}
    >
      {done && (
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
          <path
            d="M2 6.5L4.5 9L10 3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
