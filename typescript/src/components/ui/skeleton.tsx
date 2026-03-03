import { cn } from "@/lib/cn";

export function Skeleton({
  width,
  height,
  rounded,
  className,
}: {
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-pulse bg-discord-bg-accent/30",
        rounded ? "rounded-full" : "rounded",
        className
      )}
      style={{ width, height }}
    />
  );
}
