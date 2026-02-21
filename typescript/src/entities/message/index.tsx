export const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;

export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  sentAt: string;
};

export type MessageGroup = {
  id: string;
  senderId: string;
  senderName: string;
  startedAt: string;
  messages: Message[];
};

function canMergeMessage(previousMessage: Message, nextMessage: Message): boolean {
  if (previousMessage.senderId !== nextMessage.senderId) {
    return false;
  }

  const previousTimestamp = Date.parse(previousMessage.sentAt);
  const nextTimestamp = Date.parse(nextMessage.sentAt);

  if (Number.isNaN(previousTimestamp) || Number.isNaN(nextTimestamp)) {
    return false;
  }

  const diffMs = nextTimestamp - previousTimestamp;
  return diffMs >= 0 && diffMs <= MESSAGE_GROUP_WINDOW_MS;
}

/**
 * メッセージ列を「同一送信者かつ5分以内連投」でグルーピングする。
 *
 * Contract:
 * - 入力順を維持したままグループ化する
 * - 連続していない投稿（間に別送信者を挟む）は別グループ扱いにする
 */
export function groupConsecutiveMessages(messages: readonly Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const message of messages) {
    const currentGroup = groups.at(-1);
    const previousMessage = currentGroup?.messages.at(-1);

    if (currentGroup && previousMessage && canMergeMessage(previousMessage, message)) {
      currentGroup.messages.push(message);
      continue;
    }

    groups.push({
      id: `group-${message.id}`,
      senderId: message.senderId,
      senderName: message.senderName,
      startedAt: message.sentAt,
      messages: [message],
    });
  }

  return groups;
}
