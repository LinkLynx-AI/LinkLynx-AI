import { cn } from "@/lib/cn";

export function SkipNav({
  targetId = "main-content",
  className,
}: {
  targetId?: string;
  className?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        "sr-only focus:not-sr-only",
        "fixed left-2 top-2 z-[100] rounded-md bg-discord-brand-blurple px-4 py-2 text-sm font-medium text-white shadow-lg",
        "focus:outline-none focus:ring-2 focus:ring-white",
        className,
      )}
    >
      メインコンテンツへスキップ
    </a>
  );
}
