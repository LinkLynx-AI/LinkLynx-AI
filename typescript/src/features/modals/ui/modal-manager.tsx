"use client";

import { useEffect } from "react";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { CreateServerModal } from "./create-server-modal";
import { JoinServerModal } from "./join-server-modal";
import { CreateChannelModal } from "./create-channel-modal";
import { CreateInviteModal } from "./create-invite-modal";
import { ChannelDeleteModal } from "./channel-delete-modal";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { ImageLightboxModal } from "./image-lightbox-modal";
import { QuickSwitcherModal } from "./quick-switcher-modal";
import { SettingsLayout } from "@/features/settings";
import { ProfileModal, StatusSettingsModal } from "@/features/user-profile";
import { ForwardMessageModal } from "./forward-message-modal";
import { WelcomeScreenModal } from "./welcome-screen-modal";
import { ExternalLinkModal } from "./external-link-modal";
import { NsfwWarningModal } from "./nsfw-warning-modal";
import { FileWarningModal } from "./file-warning-modal";
import { ChannelEditModal } from "./channel-edit-modal";
import { OnboardingModal } from "./onboarding-modal";
import { PinConfirmModal } from "./pin-confirm-modal";
import { ReactionDetailModal } from "./reaction-detail-modal";
import { AppDirectoryModal } from "./app-directory-modal";
import { PollVotersModal } from "./poll-voters-modal";
import { ServerTemplateModal } from "./server-template-modal";
import { KeyboardShortcutsModal } from "@/shared/ui/keyboard-shortcuts-modal";

export function ModalManager() {
  const activeModal = useUIStore((s) => s.activeModal);
  const modalProps = useUIStore((s) => s.modalProps);
  const openModal = useUIStore((s) => s.openModal);
  const closeModal = useUIStore((s) => s.closeModal);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (activeModal === "quick-switcher") {
          closeModal();
        } else {
          openModal("quick-switcher");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeModal, openModal, closeModal]);

  if (!activeModal) return null;

  switch (activeModal) {
    case "create-server":
      return <CreateServerModal onClose={closeModal} />;
    case "join-server":
      return <JoinServerModal onClose={closeModal} />;
    case "create-channel":
      return (
        <CreateChannelModal
          onClose={closeModal}
          serverId={modalProps.serverId as string | undefined}
          parentId={modalProps.parentId as string | undefined}
          initialChannelType={modalProps.initialChannelType as 0 | 4 | undefined}
        />
      );
    case "create-invite":
      return (
        <CreateInviteModal
          onClose={closeModal}
          serverId={modalProps.serverId as string | undefined}
          channelId={modalProps.channelId as string | undefined}
        />
      );
    case "delete-confirm":
      return (
        <DeleteConfirmModal
          onClose={closeModal}
          title={modalProps.title as string | undefined}
          description={modalProps.description as string | undefined}
          confirmLabel={modalProps.confirmLabel as string | undefined}
          onConfirm={modalProps.onConfirm as (() => void) | undefined}
        />
      );
    case "channel-delete":
      return (
        <ChannelDeleteModal
          onClose={closeModal}
          channelId={modalProps.channelId as string | undefined}
          channelName={modalProps.channelName as string | undefined}
          channelType={modalProps.channelType as number | undefined}
          serverId={modalProps.serverId as string | undefined}
        />
      );
    case "image-lightbox":
      return (
        <ImageLightboxModal
          onClose={closeModal}
          src={modalProps.src as string | undefined}
          alt={modalProps.alt as string | undefined}
          filename={modalProps.filename as string | undefined}
        />
      );
    case "quick-switcher":
      return <QuickSwitcherModal onClose={closeModal} />;
    case "user-settings":
      return <SettingsLayout type="user" onClose={closeModal} />;
    case "server-settings":
      return (
        <SettingsLayout
          type="server"
          onClose={closeModal}
          serverId={modalProps.serverId as string | undefined}
        />
      );
    case "user-profile":
      return <ProfileModal userId={modalProps.userId as string} onClose={closeModal} />;
    case "status-settings":
      return <StatusSettingsModal onClose={closeModal} />;
    case "forward-message":
      return (
        <ForwardMessageModal
          onClose={closeModal}
          message={modalProps.message as import("@/shared/model/types/message").Message | undefined}
        />
      );
    case "welcome-screen":
      return (
        <WelcomeScreenModal
          onClose={closeModal}
          serverId={modalProps.serverId as string | undefined}
        />
      );
    case "keyboard-shortcuts":
      return <KeyboardShortcutsModal open onClose={closeModal} />;
    case "external-link":
      return <ExternalLinkModal onClose={closeModal} url={(modalProps.url as string) ?? ""} />;
    case "nsfw-warning":
      return (
        <NsfwWarningModal
          onClose={closeModal}
          onConfirm={(modalProps.onConfirm as () => void) ?? closeModal}
        />
      );
    case "file-warning":
      return (
        <FileWarningModal
          onClose={closeModal}
          filename={(modalProps.filename as string) ?? ""}
          onDownload={(modalProps.onDownload as () => void) ?? closeModal}
        />
      );
    case "channel-edit":
      return (
        <ChannelEditModal
          onClose={closeModal}
          channelId={modalProps.channelId as string | undefined}
          channelName={modalProps.channelName as string | undefined}
          channelType={modalProps.channelType as number | undefined}
        />
      );
    case "onboarding":
      return (
        <OnboardingModal
          onClose={closeModal}
          serverId={modalProps.serverId as string | undefined}
        />
      );
    case "pin-confirm":
      return (
        <PinConfirmModal
          onClose={closeModal}
          messageId={modalProps.messageId as string | undefined}
          action={modalProps.action as "pin" | "unpin" | undefined}
          currentPinCount={modalProps.currentPinCount as number | undefined}
          onConfirm={modalProps.onConfirm as (() => void) | undefined}
        />
      );
    case "reaction-detail":
      return (
        <ReactionDetailModal
          onClose={closeModal}
          messageId={modalProps.messageId as string | undefined}
          emoji={modalProps.emoji as string | undefined}
        />
      );
    case "app-directory":
      return <AppDirectoryModal onClose={closeModal} />;
    case "poll-voters":
      return (
        <PollVotersModal
          onClose={closeModal}
          pollId={modalProps.pollId as string | undefined}
          optionId={modalProps.optionId as string | undefined}
        />
      );
    case "server-template":
      return (
        <ServerTemplateModal
          onClose={closeModal}
          serverId={modalProps.serverId as string | undefined}
        />
      );
    default:
      return null;
  }
}
