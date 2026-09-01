import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Company logo. By default renders just the hexagonal "404" mark;
 * pass `variant="lockup"` for the full mark + wordmark on dark.
 * `size` is the rendered px height.
 */
export function Logo({
  size = 40,
  variant = "mark",
  className,
}: {
  size?: number;
  variant?: "mark" | "lockup";
  className?: string;
}) {
  if (variant === "lockup") {
    return (
      <Image
        src="/brand/lockup-dark.png"
        alt="404 Legends"
        width={Math.round(size * 3.4)}
        height={size}
        priority
        className={cn("select-none object-contain", className)}
      />
    );
  }

  return (
    <Image
      src="/brand/mark-512.png"
      alt="404 Legends"
      width={size}
      height={size}
      priority
      className={cn("select-none object-contain", className)}
    />
  );
}
