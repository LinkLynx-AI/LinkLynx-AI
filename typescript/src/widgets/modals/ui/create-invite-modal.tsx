"use client";

import { useState, useEffect } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/legacy/modal";
import { Button } from "@/shared/ui/legacy/button";
import { Input } from "@/shared/ui/legacy/input";
import { Select } from "@/shared/ui/legacy/select";
import { Toggle } from "@/shared/ui/legacy/toggle";
import { Avatar } from "@/shared/ui/legacy/avatar";
import { getAPIClient } from "@/shared/api/legacy/api-client";
import { Search, Send } from "lucide-react";

const expiryOptions = [
  { value: "1800", label: "30分" },
  { value: "3600", label: "1時間" },
  { value: "21600", label: "6時間" },
  { value: "43200", label: "12時間" },
  { value: "86400", label: "1日" },
  { value: "604800", label: "7日" },
  { value: "0", label: "無期限" },
];

const maxUsesOptions = [
  { value: "0", label: "無制限" },
  { value: "1", label: "1回" },
  { value: "5", label: "5回" },
  { value: "10", label: "10回" },
  { value: "25", label: "25回" },
  { value: "50", label: "50回" },
  { value: "100", label: "100回" },
];

const friendUsers: {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}[] = [];

export function CreateInviteModal({
  onClose,
  channelId,
}: {
  onClose: () => void;
  channelId?: string;
}) {
  const [inviteLink, setInviteLink] = useState("");
  const [maxAge, setMaxAge] = useState("86400");
  const [maxUses, setMaxUses] = useState("0");
  const [temporary, setTemporary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!channelId) return;
    const api = getAPIClient();
    api
      .createInvite(channelId, { maxAge: Number(maxAge) })
      .then((invite) => {
        setInviteLink(`https://discord.gg/${invite.code}`);
      })
      .catch(() => {
        setInviteLink("");
      });
  }, [channelId, maxAge]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToFriend = (userId: string) => {
    setSentTo((prev) => new Set(prev).add(userId));
  };

  const filteredFriends = friendUsers.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(friendSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(friendSearch.toLowerCase()),
  );

  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>フレンドを招待</ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          {/* Friend Search */}
          <div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-discord-text-muted" />
              <input
                type="text"
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                placeholder="フレンドを検索"
                className="h-10 w-full rounded-[3px] bg-discord-input-bg pl-9 pr-3 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none focus:outline-2 focus:outline-discord-brand-blurple"
              />
            </div>
            <div className="max-h-[160px] space-y-0.5 overflow-y-auto">
              {filteredFriends.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-discord-bg-mod-hover"
                >
                  <Avatar
                    src={user.avatar ?? undefined}
                    alt={user.displayName ?? user.username}
                    size={32}
                  />
                  <span className="flex-1 truncate text-sm text-discord-text-normal">
                    {user.displayName ?? user.username}
                  </span>
                  <Button
                    variant={sentTo.has(user.id) ? "secondary" : "success"}
                    size="sm"
                    disabled={sentTo.has(user.id)}
                    onClick={() => handleSendToFriend(user.id)}
                    className="h-7 px-3 text-xs"
                  >
                    {sentTo.has(user.id) ? (
                      "送信済み"
                    ) : (
                      <>
                        <Send className="mr-1 h-3 w-3" />
                        送信
                      </>
                    )}
                  </Button>
                </div>
              ))}
              {filteredFriends.length === 0 && (
                <p className="py-3 text-center text-xs text-discord-text-muted">
                  フレンドが見つかりません
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-discord-divider pt-4">
            <p className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
              有効期限
            </p>
            <Select options={expiryOptions} value={maxAge} onChange={setMaxAge} />
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
              使用回数上限
            </p>
            <Select options={maxUsesOptions} value={maxUses} onChange={setMaxUses} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-discord-text-normal">一時メンバーとして招待</span>
            <Toggle checked={temporary} onChange={setTemporary} />
          </div>

          <div className="border-t border-discord-divider pt-4">
            <p className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
              招待リンク
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded-[3px] bg-discord-input-bg px-3 py-2 text-sm text-discord-text-normal">
                {inviteLink || "生成中..."}
              </div>
              <Button onClick={handleCopy} disabled={!inviteLink}>
                {copied ? "コピー済み!" : "コピー"}
              </Button>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          閉じる
        </Button>
      </ModalFooter>
    </Modal>
  );
}
