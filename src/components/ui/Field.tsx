import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const base =
  "rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-accent focus:outline-none disabled:opacity-50";

function Wrap({
  label,
  error,
  htmlFor,
  children,
}: {
  label?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-sm text-foreground-muted">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function TextField({
  label,
  error,
  id,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <Wrap label={label} error={error} htmlFor={id}>
      <input id={id} className={cn(base, className)} {...props} />
    </Wrap>
  );
}

export function TextAreaField({
  label,
  error,
  id,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
}) {
  return (
    <Wrap label={label} error={error} htmlFor={id}>
      <textarea id={id} className={cn(base, "min-h-20 resize-y", className)} {...props} />
    </Wrap>
  );
}

export function SelectField({
  label,
  error,
  id,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
}) {
  return (
    <Wrap label={label} error={error} htmlFor={id}>
      <select id={id} className={cn(base, className)} {...props}>
        {children}
      </select>
    </Wrap>
  );
}
