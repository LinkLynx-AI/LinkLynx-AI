"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowLeft, Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tabs } from "@/components/ui/tabs";
import { PermissionToggle } from "./permission-toggle";
import { RoleColorPicker } from "./role-color-picker";
import { type MockRole, PERMISSION_FLAGS, hasPermission } from "@/services/mock/data/roles";

type PermissionState = "allow" | "deny" | "inherit";

const TABS = [
  { id: "display", label: "表示" },
  { id: "permissions", label: "権限" },
  { id: "members", label: "メンバー" },
  { id: "links", label: "リンク" },
];

interface PermissionDef {
  flag: number;
  label: string;
  description: string;
  category: string;
}

const PERMISSION_DEFS: PermissionDef[] = [
  {
    flag: PERMISSION_FLAGS.ADMINISTRATOR,
    label: "管理者",
    description: "すべての権限を持ち、チャンネル固有の権限を上書きします",
    category: "一般",
  },
  {
    flag: PERMISSION_FLAGS.MANAGE_CHANNELS,
    label: "チャンネルの管理",
    description: "チャンネルの作成、編集、削除ができます",
    category: "一般",
  },
  {
    flag: PERMISSION_FLAGS.MANAGE_GUILD,
    label: "サーバーの管理",
    description: "サーバー名やリージョンを変更できます",
    category: "一般",
  },
  {
    flag: PERMISSION_FLAGS.MANAGE_ROLES,
    label: "ロールの管理",
    description: "ロールの作成、編集、削除ができます",
    category: "一般",
  },
  {
    flag: PERMISSION_FLAGS.KICK_MEMBERS,
    label: "メンバーをキック",
    description: "メンバーをサーバーからキックできます",
    category: "一般",
  },
  {
    flag: PERMISSION_FLAGS.BAN_MEMBERS,
    label: "メンバーをBAN",
    description: "メンバーをサーバーからBANできます",
    category: "一般",
  },
  {
    flag: PERMISSION_FLAGS.VIEW_AUDIT_LOG,
    label: "監査ログの表示",
    description: "サーバーの監査ログを表示できます",
    category: "一般",
  },
  {
    flag: PERMISSION_FLAGS.VIEW_CHANNEL,
    label: "チャンネルを見る",
    description: "チャンネルを閲覧できます",
    category: "テキスト",
  },
  {
    flag: PERMISSION_FLAGS.SEND_MESSAGES,
    label: "メッセージを送信",
    description: "テキストチャンネルにメッセージを送信できます",
    category: "テキスト",
  },
  {
    flag: PERMISSION_FLAGS.MANAGE_MESSAGES,
    label: "メッセージの管理",
    description: "他のメンバーのメッセージを削除、ピン留めできます",
    category: "テキスト",
  },
  {
    flag: PERMISSION_FLAGS.EMBED_LINKS,
    label: "埋め込みリンク",
    description: "リンクのプレビューを送信できます",
    category: "テキスト",
  },
  {
    flag: PERMISSION_FLAGS.ATTACH_FILES,
    label: "ファイルを添付",
    description: "メッセージにファイルを添付できます",
    category: "テキスト",
  },
  {
    flag: PERMISSION_FLAGS.ADD_REACTIONS,
    label: "リアクションの追加",
    description: "メッセージにリアクションを追加できます",
    category: "テキスト",
  },
  {
    flag: PERMISSION_FLAGS.READ_MESSAGE_HISTORY,
    label: "メッセージ履歴を読む",
    description: "過去のメッセージを読むことができます",
    category: "テキスト",
  },
  {
    flag: PERMISSION_FLAGS.MENTION_EVERYONE,
    label: "@everyoneにメンション",
    description: "@everyone、@here、すべてのロールにメンションできます",
    category: "テキスト",
  },
  {
    flag: PERMISSION_FLAGS.CONNECT,
    label: "接続",
    description: "ボイスチャンネルに接続できます",
    category: "ボイス",
  },
  {
    flag: PERMISSION_FLAGS.SPEAK,
    label: "発言",
    description: "ボイスチャンネルで発言できます",
    category: "ボイス",
  },
  {
    flag: PERMISSION_FLAGS.MUTE_MEMBERS,
    label: "メンバーをミュート",
    description: "メンバーのマイクをミュートできます",
    category: "ボイス",
  },
  {
    flag: PERMISSION_FLAGS.DEAFEN_MEMBERS,
    label: "メンバーのスピーカーをミュート",
    description: "メンバーのスピーカーをオフにできます",
    category: "ボイス",
  },
  {
    flag: PERMISSION_FLAGS.MOVE_MEMBERS,
    label: "メンバーを移動",
    description: "メンバーを他のボイスチャンネルに移動できます",
    category: "ボイス",
  },
];

const MOCK_MEMBERS = [
  { id: "u1", username: "田中太郎", avatar: "T", discriminator: "1234" },
  { id: "u2", username: "佐藤花子", avatar: "S", discriminator: "5678" },
  { id: "u3", username: "鈴木一郎", avatar: "Z", discriminator: "9012" },
  { id: "u4", username: "高橋美咲", avatar: "A", discriminator: "3456" },
  { id: "u5", username: "渡辺健", avatar: "W", discriminator: "7890" },
];

export function RoleEditPanel({
  role,
  onSave,
  onBack,
}: {
  role: MockRole;
  onSave?: (role: MockRole) => void;
  onBack?: () => void;
}) {
  const [activeTab, setActiveTab] = useState("display");
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(role.color);
  const [hoist, setHoist] = useState(role.hoist);
  const [mentionable, setMentionable] = useState(role.mentionable);
  const [permissions, setPermissions] = useState(role.permissions);
  const [memberSearch, setMemberSearch] = useState("");

  const hasChanges =
    name !== role.name ||
    color !== role.color ||
    hoist !== role.hoist ||
    mentionable !== role.mentionable ||
    permissions !== role.permissions;

  function getPermState(flag: number): PermissionState {
    if (hasPermission(permissions, flag)) return "allow";
    return "inherit";
  }

  function setPermState(flag: number, state: PermissionState) {
    if (state === "allow") {
      setPermissions((prev) => prev | flag);
    } else {
      setPermissions((prev) => prev & ~flag);
    }
  }

  function handleSave() {
    onSave?.({
      ...role,
      name,
      color,
      hoist,
      mentionable,
      permissions,
    });
  }

  const categories = Array.from(new Set(PERMISSION_DEFS.map((p) => p.category)));

  const filteredMembers = MOCK_MEMBERS.filter((m) =>
    m.username.toLowerCase().includes(memberSearch.toLowerCase()),
  );

  return (
    <div className="flex-1">
      {/* Header with back button */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-discord-text-link hover:underline"
          aria-label="戻る"
        >
          <ArrowLeft className="h-4 w-4" />
          戻る
        </button>
        <span className="text-sm text-discord-text-muted">—</span>
        <h3 className="text-base font-semibold text-discord-header-primary">
          ロールの編集 — {role.name}
        </h3>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} className="mb-4" />

      {/* Tab content */}
      {activeTab === "display" && (
        <div className="space-y-6">
          <Input
            label="ロール名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
              ロールの色
            </label>
            <RoleColorPicker value={color} onChange={setColor} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-discord-text-normal">ロールをメンバーリストで分ける</p>
              <p className="text-xs text-discord-text-muted">
                このロールのメンバーをメンバーリストで別のグループとして表示します
              </p>
            </div>
            <Toggle checked={hoist} onChange={setHoist} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-discord-text-normal">このロールに@mentionを許可</p>
              <p className="text-xs text-discord-text-muted">
                メンバーがこのロールに@mentionできるようになります
              </p>
            </div>
            <Toggle checked={mentionable} onChange={setMentionable} />
          </div>
        </div>
      )}

      {activeTab === "permissions" && (
        <div>
          {categories.map((cat) => (
            <div key={cat} className="mb-6">
              <h4 className="mb-2 text-xs font-bold uppercase text-discord-text-muted">{cat}</h4>
              {PERMISSION_DEFS.filter((p) => p.category === cat).map((perm) => (
                <PermissionToggle
                  key={perm.flag}
                  value={getPermState(perm.flag)}
                  onChange={(state) => setPermState(perm.flag, state)}
                  label={perm.label}
                  description={perm.description}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {activeTab === "members" && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-discord-text-muted" />
              <input
                type="text"
                placeholder="メンバーを検索..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="h-8 w-full rounded-[3px] bg-discord-input-bg pl-9 pr-3 text-sm text-discord-text-normal outline-none focus:outline-2 focus:outline-discord-brand-blurple"
              />
            </div>
            <Button size="sm">
              <UserPlus className="mr-1.5 h-4 w-4" />
              メンバーを追加
            </Button>
          </div>

          <div className="space-y-1">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded px-3 py-2 hover:bg-discord-bg-mod-hover"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: color }}
                >
                  {member.avatar}
                </div>
                <div className="flex-1">
                  <span className="text-sm text-discord-text-normal">{member.username}</span>
                  <span className="ml-1 text-xs text-discord-text-muted">
                    #{member.discriminator}
                  </span>
                </div>
                <button className="text-xs text-discord-text-muted hover:text-discord-brand-red">
                  削除
                </button>
              </div>
            ))}
            {filteredMembers.length === 0 && (
              <p className="py-4 text-center text-sm text-discord-text-muted">
                メンバーが見つかりません
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === "links" && (
        <div>
          <div className="rounded-lg bg-discord-bg-secondary p-6 text-center">
            <h4 className="mb-2 text-sm font-semibold text-discord-header-primary">
              リンクされたロール
            </h4>
            <p className="mb-4 text-sm text-discord-text-muted">
              外部サービスとの連携でロールを自動的に付与できます。
              ボットやインテグレーションを使ってリンクされたロールを設定してください。
            </p>
            <Button variant="secondary" size="sm">
              インテグレーションを管理
            </Button>
          </div>
        </div>
      )}

      {/* Save bar */}
      {hasChanges && (
        <div className="mt-6 flex items-center justify-end gap-3 rounded-lg bg-discord-bg-tertiary p-3">
          <span className="mr-auto text-sm text-discord-text-normal">変更が保存されていません</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setName(role.name);
              setColor(role.color);
              setHoist(role.hoist);
              setMentionable(role.mentionable);
              setPermissions(role.permissions);
            }}
          >
            リセット
          </Button>
          <Button size="sm" onClick={handleSave}>
            変更を保存
          </Button>
        </div>
      )}
    </div>
  );
}
