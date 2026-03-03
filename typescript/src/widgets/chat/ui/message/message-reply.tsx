import { Avatar } from "@/shared/ui/avatar";
import type { Message } from "@/shared/model/types/message";

export function MessageReply({ referencedMessage }: { referencedMessage: Message | null }) {
  if (!referencedMessage) return null;

  return (
    <div className="mb-0.5 flex items-center gap-1 pl-0.5">
      <svg
        className="mr-0.5 shrink-0 text-discord-interactive-muted"
        width="33"
        height="20"
        viewBox="0 0 33 20"
        fill="none"
      >
        <path
          d="M6.5 17.5C6.5 9 6.5 5.5 13 2.5H33"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <Avatar
        src={referencedMessage.author.avatar ?? undefined}
        alt={referencedMessage.author.displayName}
        size={16}
      />
      <span className="text-xs font-medium text-discord-header-secondary hover:underline cursor-pointer">
        {referencedMessage.author.displayName}
      </span>
      <span className="truncate text-xs text-discord-text-muted hover:text-discord-text-normal cursor-pointer">
        {referencedMessage.content}
      </span>
    </div>
  );
}
