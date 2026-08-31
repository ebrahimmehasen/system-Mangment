import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-50",
  secondary:
    "bg-surface-2 text-foreground border border-border hover:bg-surface disabled:opacity-50",
  ghost: "text-foreground-muted hover:text-foreground hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
