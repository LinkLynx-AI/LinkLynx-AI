"use client";

import { Modal } from "@/shared/ui/modal";

export function ReactionDetailModal({
  onClose,
  messageId,
  emoji,
}: {
  onClose: () => void;
  messageId?: string;
  emoji?: string;
}) {
  return (
    <Modal open onClose={onClose} className="max-w-[480px]">
      <div className="p-6">
        <h3 className="text-base font-semibold text-discord-header-primary">
          リアクション詳細は未接続です
        </h3>
        <p className="mt-3 text-sm leading-6 text-discord-text-muted">
          v1 では reaction persistence は完了していますが、誰がどの絵文字を付けたかを取得する UI/API
          接続はまだありません。
        </p>
        <div className="mt-4 rounded-md border border-discord-divider bg-discord-bg-secondary p-4 text-sm text-discord-text-muted">
          {emoji ? `対象 emoji: ${emoji}` : "対象 emoji: 未指定"}
          <br />
          {messageId ? `対象 message_id: ${messageId}` : "対象 message_id: 未指定"}
        </div>
      </div>
    </Modal>
  );
}
