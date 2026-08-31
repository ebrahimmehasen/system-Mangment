import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm text-foreground-muted">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-accent focus:outline-none",
          className,
        )}
        {...props}
      />
    </div>
  );
}
