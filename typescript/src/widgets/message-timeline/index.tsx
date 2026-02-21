import { groupConsecutiveMessages, type Message } from "@/entities";

type MessageTimelineProps = {
  messages: readonly Message[];
  emptyLabel?: string;
};

function formatUtcTimeLabel(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * メッセージ一覧を連続投稿グルーピングで表示する。
 *
 * Contract:
 * - 同一送信者かつ5分以内の連投は1グループで描画する
 * - グループヘッダーは送信者単位で1回だけ表示する
 */
export function MessageTimeline({
  messages,
  emptyLabel = "メッセージはまだありません。",
}: MessageTimelineProps) {
  const groupedMessages = groupConsecutiveMessages(messages);

  return (
    <section aria-label="メッセージ一覧" className="space-y-4">
      <h2 className="text-xl font-semibold text-white">メッセージ一覧</h2>
      {groupedMessages.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-discord-dark px-4 py-3 text-sm text-white/75">
          {emptyLabel}
        </p>
      ) : (
        <ol className="space-y-4">
          {groupedMessages.map((group) => (
            <li key={group.id}>
              <article className="rounded-lg border border-white/10 bg-discord-darker/80">
                <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <h3 className="text-sm font-semibold text-white">{group.senderName}</h3>
                  <time className="text-xs text-white/65" dateTime={group.startedAt}>
                    {formatUtcTimeLabel(group.startedAt)}
                  </time>
                </header>
                <ul className="space-y-2 px-4 py-3">
                  {group.messages.map((message) => (
                    <li key={message.id} className="rounded-md bg-discord-dark px-3 py-2">
                      <p className="text-sm leading-relaxed text-white">{message.body}</p>
                      <time className="mt-1 block text-xs text-white/60" dateTime={message.sentAt}>
                        {formatUtcTimeLabel(message.sentAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
