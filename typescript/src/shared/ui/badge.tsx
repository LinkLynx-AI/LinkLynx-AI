import { cn } from "@/shared/lib/cn";

export function Badge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-discord-brand-red px-1 text-xs font-bold text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
