import Image from "next/image";
import { cn } from "@/lib/cn";

/** Company logo mark. `size` is the rendered px square. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt="404 Legends"
      width={size}
      height={size}
      priority
      className={cn("select-none", className)}
    />
  );
}
