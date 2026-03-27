"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody } from "@/shared/ui/modal";
import { Tabs } from "@/shared/ui/tabs-simple";
import { ChannelEditOverview } from "./channel-edit-overview";
import { ChannelEditInvites } from "./channel-edit-invites";

const tabs = [
  { id: "overview", label: "概要" },
  { id: "invites", label: "招待" },
];

export function ChannelEditModal({
  onClose,
  channelId,
  channelName,
  channelType,
  serverId,
}: {
  onClose: () => void;
  channelId?: string;
  channelName?: string;
  channelType?: number;
  serverId?: string;
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
        {activeTab === "invites" && (
          <ChannelEditInvites serverId={serverId} channelId={channelId} />
        )}
      </ModalBody>
    </Modal>
  );
}
