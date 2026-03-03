"use client";

import { MicOff, HeadphoneOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

type VoiceParticipantData = {
  userId: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  displayName: string;
  avatar: string | null;
};

export function VoiceParticipantTile({
  participant,
  isCurrentUser,
  serverMuted = false,
  serverDeafened = false,
  onContextMenu,
}: {
  participant: VoiceParticipantData;
  isCurrentUser?: boolean;
  serverMuted?: boolean;
  serverDeafened?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const { displayName, avatar, speaking, muted, deafened, cameraOn, screenSharing } = participant;

  if (screenSharing) {
    return (
      <div
        className="flex flex-col items-center gap-2 rounded-lg bg-discord-bg-secondary p-4"
        onContextMenu={onContextMenu}
      >
        <div className="relative flex h-[120px] w-full items-center justify-center rounded-md bg-gradient-to-br from-discord-brand-blurple/30 to-discord-brand-blurple/10">
          <span className="text-sm text-discord-text-muted">{displayName}の画面</span>
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            画面共有中
          </span>
        </div>
        <span className="text-sm text-discord-text-normal">{displayName}</span>
      </div>
    );
  }

  if (cameraOn) {
    return (
      <div
        className="flex flex-col items-center gap-2 rounded-lg bg-discord-bg-secondary p-4"
        onContextMenu={onContextMenu}
      >
        <div className="relative h-[120px] w-full rounded-md bg-gradient-to-br from-emerald-800/40 to-teal-600/20">
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            カメラON
          </span>
        </div>
        <span className="text-sm text-discord-text-normal">{displayName}</span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-lg bg-discord-bg-secondary p-4"
      onContextMenu={onContextMenu}
    >
      <div className="relative">
        <div
          className={cn(
            "rounded-full transition-shadow duration-200",
            speaking && "shadow-[0_0_0_3px_#23A55A] animate-voice-ring",
          )}
        >
          <Avatar src={avatar ?? undefined} alt={displayName} size={80} />
        </div>
        {serverDeafened ? (
          <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-discord-btn-danger">
            <HeadphoneOff className="h-3.5 w-3.5 text-white" />
          </span>
        ) : serverMuted ? (
          <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-discord-btn-danger ring-2 ring-discord-bg-secondary">
            <MicOff className="h-3.5 w-3.5 text-white" />
          </span>
        ) : deafened ? (
          <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-discord-btn-danger">
            <HeadphoneOff className="h-3.5 w-3.5 text-white" />
          </span>
        ) : muted ? (
          <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-discord-btn-danger">
            <MicOff className="h-3.5 w-3.5 text-white" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-col items-center">
        <span className="text-sm text-discord-text-normal">
          {displayName}
          {isCurrentUser && " (自分)"}
        </span>
        {serverMuted && !serverDeafened && (
          <span className="text-[10px] text-discord-btn-danger">サーバーミュート</span>
        )}
        {serverDeafened && (
          <span className="text-[10px] text-discord-btn-danger">サーバースピーカーミュート</span>
        )}
      </div>
    </div>
  );
}
