import { cn } from "@/shared/lib/cn";
import { useUIStore } from "@/shared/model/stores/ui-store";
import type { Reaction } from "@/shared/model/types/message";

export function MessageReactions({
  reactions,
  messageId,
}: {
  reactions: Reaction[];
  messageId?: string;
}) {
  const openModal = useUIStore((s) => s.openModal);
  if (reactions.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji.name}
          onClick={() =>
            openModal("reaction-detail", {
              messageId,
              emoji: reaction.emoji.name,
            })
          }
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
            "text-xs cursor-pointer transition-colors",
            reaction.me
              ? "border border-discord-brand-blurple/40 bg-discord-brand-blurple/15 text-discord-text-normal"
              : "border border-discord-bg-accent/40 bg-discord-bg-secondary text-discord-text-normal",
            "hover:bg-discord-bg-mod-hover",
          )}
        >
          <span>{reaction.emoji.name}</span>
          <span>{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}
