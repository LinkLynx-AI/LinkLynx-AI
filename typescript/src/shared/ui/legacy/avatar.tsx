import { cn } from "@/shared/lib/legacy/cn";

const sizeMap = {
  16: "h-4 w-4",
  32: "h-8 w-8",
  40: "h-10 w-10",
  80: "h-20 w-20",
  128: "h-32 w-32",
};

const statusDotSize = {
  16: "h-1.5 w-1.5 border",
  32: "h-2.5 w-2.5 border-2",
  40: "h-3 w-3 border-2",
  80: "h-5 w-5 border-[3px]",
  128: "h-8 w-8 border-4",
};

const statusColors = {
  online: "bg-discord-status-online",
  idle: "bg-discord-status-idle",
  dnd: "bg-discord-status-dnd",
  offline: "bg-discord-status-offline",
};

export function Avatar({
  src,
  alt,
  size = 40,
  status,
  className,
}: {
  src?: string;
  alt: string;
  size?: 16 | 32 | 40 | 80 | 128;
  status?: "online" | "idle" | "dnd" | "offline";
  className?: string;
}) {
  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {src ? (
        <img src={src} alt={alt} className={cn("rounded-full object-cover", sizeMap[size])} />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-discord-brand-blurple text-white font-medium select-none",
            sizeMap[size],
            size <= 16 && "text-[8px]",
            size === 32 && "text-xs",
            size === 40 && "text-sm",
            size === 80 && "text-2xl",
            size === 128 && "text-4xl",
          )}
        >
          {alt.charAt(0).toUpperCase()}
        </div>
      )}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-discord-bg-primary",
            statusDotSize[size],
            statusColors[status],
          )}
        />
      )}
    </div>
  );
}
