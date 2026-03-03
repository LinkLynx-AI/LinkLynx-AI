import { cn } from "@/shared/lib/legacy/cn";

export function Divider({ text, className }: { text?: string; className?: string }) {
  if (text) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-px flex-1 bg-discord-divider" />
        <span className="text-xs font-semibold text-discord-text-muted">{text}</span>
        <div className="h-px flex-1 bg-discord-divider" />
      </div>
    );
  }

  return <div className={cn("h-px bg-discord-divider", className)} />;
}
