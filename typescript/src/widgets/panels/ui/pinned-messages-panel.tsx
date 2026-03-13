"use client";

import { Pin } from "lucide-react";

export function PinnedMessagesPanel() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm rounded-xl border border-discord-divider bg-discord-bg-tertiary p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-discord-bg-mod-hover text-discord-header-primary">
          <Pin className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-discord-header-primary">
          ピン留め一覧は未接続です
        </h3>
        <p className="mt-2 text-sm leading-6 text-discord-text-muted">
          v1 では pin persistence は整備済みですが、一覧取得と pin/unpin 操作の UI/API
          接続はまだ入っていません。 このパネルは接続状態を明示するための案内表示です。
        </p>
      </div>
    </div>
  );
}
