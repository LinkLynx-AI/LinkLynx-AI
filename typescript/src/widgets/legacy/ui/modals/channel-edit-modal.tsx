"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody } from "@/shared/ui/legacy/modal";
import { Tabs } from "@/shared/ui/legacy/tabs";
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
}: {
  onClose: () => void;
  channelId?: string;
  channelName?: string;
}) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <Modal open onClose={onClose} className="max-w-[660px]">
      <ModalHeader>{channelName ? `#${channelName} の編集` : "チャンネルを編集"}</ModalHeader>
      <div className="px-4">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>
      <ModalBody>
        {activeTab === "overview" && <ChannelEditOverview channelId={channelId} />}
        {activeTab === "permissions" && <ChannelEditPermissions channelId={channelId} />}
        {activeTab === "invites" && <ChannelEditInvites channelId={channelId} />}
        {activeTab === "integrations" && <ChannelEditIntegrations channelId={channelId} />}
      </ModalBody>
    </Modal>
  );
}
