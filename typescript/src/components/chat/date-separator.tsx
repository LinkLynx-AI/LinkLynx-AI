import { formatDateSeparator } from "@/lib/format-date";

export function DateSeparator({ date }: { date: string }) {
  return (
    <div className="mx-4 my-2 flex items-center">
      <div className="h-px flex-1 bg-discord-divider" />
      <span className="px-2 text-xs text-discord-text-muted">
        {formatDateSeparator(date)}
      </span>
      <div className="h-px flex-1 bg-discord-divider" />
    </div>
  );
}
