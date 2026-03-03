import { cn } from "@/shared/lib/legacy/cn";
import { ImageOff } from "lucide-react";

export function ImageError({ filename, className }: { filename?: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md bg-discord-bg-tertiary px-4 py-3 text-discord-text-muted",
        className,
      )}
    >
      <ImageOff className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="truncate text-sm">{filename ?? "画像を読み込めませんでした"}</span>
    </div>
  );
}
