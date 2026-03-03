"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ChannelMuteSubmenu } from "./channel-mute-submenu";

const notificationOptions = [
  { value: "all", label: "すべてのメッセージ" },
  { value: "mentions", label: "メンションのみ" },
  { value: "nothing", label: "通知なし" },
];

interface ServerNotificationSettingsProps {
  serverId: string;
  serverName: string;
  onClose: () => void;
}

export function ServerNotificationSettings({
  serverId,
  serverName,
  onClose,
}: ServerNotificationSettingsProps) {
  const [defaultNotification, setDefaultNotification] = useState("all");
  const [muted, setMuted] = useState(false);
  const [muteDuration, setMuteDuration] = useState<number | null>(null);
  const [suppressEveryone, setSuppressEveryone] = useState(false);
  const [roleMentions, setRoleMentions] = useState(true);

  function handleSave() {
    // Mock save
    onClose();
  }

  return (
    <Modal open onClose={onClose}>
      <ModalHeader>{serverName} - 通知設定</ModalHeader>
      <ModalBody className="space-y-6">
        {/* Default notification */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
            デフォルト通知
          </label>
          <Select
            options={notificationOptions}
            value={defaultNotification}
            onChange={setDefaultNotification}
          />
        </div>

        {/* Mute server */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-discord-text-normal">サーバーをミュート</h3>
              <p className="text-xs text-discord-text-muted">
                このサーバーからの通知を一時的に無効にします
              </p>
            </div>
            <Toggle checked={muted} onChange={setMuted} />
          </div>
          {muted && (
            <div className="ml-2 rounded-lg bg-discord-bg-secondary p-3">
              <ChannelMuteSubmenu onSelect={setMuteDuration} currentDuration={muteDuration} />
            </div>
          )}
        </div>

        {/* Suppress @everyone */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-discord-text-normal">@everyoneを抑制</h3>
            <p className="text-xs text-discord-text-muted">
              @everyone と @here のメンション通知を無効にします
            </p>
          </div>
          <Toggle checked={suppressEveryone} onChange={setSuppressEveryone} />
        </div>

        {/* Role mentions */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-discord-text-normal">ロールメンション通知</h3>
            <p className="text-xs text-discord-text-muted">
              ロールへのメンション通知を有効にします
            </p>
          </div>
          <Toggle checked={roleMentions} onChange={setRoleMentions} />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          キャンセル
        </Button>
        <Button onClick={handleSave}>設定を保存</Button>
      </ModalFooter>
    </Modal>
  );
}
