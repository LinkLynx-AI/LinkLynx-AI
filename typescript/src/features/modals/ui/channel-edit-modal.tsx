"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody } from "@/shared/ui/modal";
import { Tabs } from "@/shared/ui/tabs-simple";
import { ChannelEditOverview } from "./channel-edit-overview";
import { ChannelEditPermissions } from "./channel-edit-permissions";
import { ChannelEditInvites } from "./channel-edit-invites";
import { ChannelEditIntegrations } from "./channel-edit-integrations";

const tabs = [
  { id: "overview", label: "概要" },
  { id: "permissions", label: "権限" },
  { id: "invites", label: "招待" },
  { id: "integrations", label: "連携" },
];

export function ChannelEditModal({
  onClose,
  channelId,
  channelName,
  channelType,
}: {
  onClose: () => void;
  channelId?: string;
  channelName?: string;
  channelType?: number;
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const title =
    channelName === undefined
      ? "チャンネルを編集"
      : channelType === 4
        ? `${channelName} の編集`
        : `#${channelName} の編集`;

  return (
    <Modal open onClose={onClose} className="max-w-[660px]">
      <ModalHeader>{title}</ModalHeader>
      <div className="px-4">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>
      <ModalBody>
        {activeTab === "overview" && (
          <ChannelEditOverview channelId={channelId} onSaved={onClose} />
        )}
        {activeTab === "permissions" && <ChannelEditPermissions channelId={channelId} />}
        {activeTab === "invites" && <ChannelEditInvites channelId={channelId} />}
        {activeTab === "integrations" && <ChannelEditIntegrations channelId={channelId} />}
      </ModalBody>
    </Modal>
  );
}
