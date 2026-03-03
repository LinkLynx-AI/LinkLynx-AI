"use client";

import { useState } from "react";
import { Hash } from "lucide-react";
import { PermissionToggle } from "./permission-toggle";

type PermissionState = "allow" | "deny" | "inherit";

type ChannelPermDef = {
  id: string;
  label: string;
  description: string;
};

const CHANNEL_PERMISSIONS: ChannelPermDef[] = [
  { id: "view_channel", label: "チャンネルを見る", description: "このチャンネルを閲覧できます" },
  {
    id: "send_messages",
    label: "メッセージを送信",
    description: "このチャンネルにメッセージを送信できます",
  },
  {
    id: "manage_messages",
    label: "メッセージの管理",
    description: "メッセージの削除やピン留めができます",
  },
  { id: "attach_files", label: "ファイルを添付", description: "ファイルやメディアを添付できます" },
  {
    id: "add_reactions",
    label: "リアクションの追加",
    description: "メッセージにリアクションを追加できます",
  },
  { id: "embed_links", label: "埋め込みリンク", description: "リンクのプレビューを送信できます" },
];

export function ChannelPermissions({
  channelId,
  channelName,
  roleId,
}: {
  channelId: string;
  channelName: string;
  roleId: string;
}) {
  const [overrides, setOverrides] = useState<Record<string, PermissionState>>(() =>
    Object.fromEntries(CHANNEL_PERMISSIONS.map((p) => [p.id, "inherit" as const])),
  );

  function setPermission(id: string, state: PermissionState) {
    setOverrides((prev) => ({ ...prev, [id]: state }));
  }

  const hasOverrides = Object.values(overrides).some((v) => v !== "inherit");

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Hash className="h-5 w-5 text-discord-channel-icon" />
        <h3 className="text-base font-semibold text-discord-header-primary">{channelName}</h3>
      </div>

      <p className="mb-4 text-xs text-discord-text-muted">
        このロールのチャンネル固有の権限オーバーライド
      </p>

      {hasOverrides && (
        <div className="mb-3 rounded bg-discord-bg-secondary px-3 py-2">
          <p className="text-xs text-discord-text-warning">
            {Object.values(overrides).filter((v) => v !== "inherit").length}{" "}
            件の権限オーバーライドが設定されています
          </p>
        </div>
      )}

      <div>
        {CHANNEL_PERMISSIONS.map((perm) => (
          <PermissionToggle
            key={perm.id}
            value={overrides[perm.id]}
            onChange={(state) => setPermission(perm.id, state)}
            label={perm.label}
            description={perm.description}
          />
        ))}
      </div>
    </div>
  );
}
