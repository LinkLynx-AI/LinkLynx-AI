import { Avatar } from "@/components/ui/avatar";
import type { User } from "@/types";

export function DmWelcomeMessage({ recipient }: { recipient: User }) {
  return (
    <div className="px-4 pb-4 pt-8">
      <Avatar
        src={recipient.avatar ?? undefined}
        alt={recipient.displayName}
        size={80}
        className="mb-2"
      />
      <h1 className="text-3xl font-bold text-discord-header-primary">{recipient.displayName}</h1>
      <p className="mt-1 text-discord-text-muted">
        これは @{recipient.displayName} とのダイレクトメッセージの最初です。
      </p>
    </div>
  );
}
