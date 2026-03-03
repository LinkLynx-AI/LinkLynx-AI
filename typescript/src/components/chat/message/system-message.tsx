import { ArrowRight, Rocket, Pin } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMessageTimestamp } from "@/lib/format-date";
import type { Message } from "@/types/message";

function getSystemMessageContent(message: Message) {
  const name = message.author.displayName;
  switch (message.type) {
    case 7:
      return { icon: ArrowRight, color: "text-discord-brand-green", text: `${name} がサーバーに参加しました。` };
    case 8:
    case 9:
    case 10:
    case 11:
      return { icon: Rocket, color: "text-discord-brand-fuchsia", text: `${name} がサーバーをブーストしました！` };
    case 6:
      return { icon: Pin, color: "text-discord-text-muted", text: `${name} がメッセージをピン留めしました。` };
    default:
      return { icon: ArrowRight, color: "text-discord-text-muted", text: message.content };
  }
}

export function SystemMessage({ message }: { message: Message }) {
  const { icon: Icon, color, text } = getSystemMessageContent(message);

  return (
    <div className="flex items-center gap-2 px-4 py-0.5">
      <Icon className={cn("h-4 w-4 shrink-0", color)} />
      <span className="text-sm text-discord-text-muted">
        {text}
      </span>
      <span className="text-xs text-discord-text-muted">
        {formatMessageTimestamp(message.timestamp)}
      </span>
    </div>
  );
}
