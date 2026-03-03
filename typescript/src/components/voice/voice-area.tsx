"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { useVoiceStore } from "@/stores/voice-store";
import { useAuthStore } from "@/stores/auth-store";
import { mockUsers } from "@/services/mock/data/users";
import { VoiceParticipantTile } from "./voice-participant-tile";
import { VoiceControlBar } from "./voice-control-bar";
import { TextInVoice } from "./text-in-voice";
import { CallScreen } from "./call-screen";
import { ClipsPreviewCard } from "./clips-preview-card";
import type { ClipData } from "./clips-preview-card";

function resolveUser(userId: string) {
  const user = mockUsers.find((u) => u.id === userId);
  return {
    displayName: user?.displayName ?? userId,
    avatar: user?.avatar ?? null,
  };
}

export function VoiceArea({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const participants = useVoiceStore((s) => s.participants);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const cameraOn = useVoiceStore((s) => s.cameraOn);
  const screenSharing = useVoiceStore((s) => s.screenSharing);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [showTextChat, setShowTextChat] = useState(false);
  const [showCallScreen, setShowCallScreen] = useState(false);
  const [callType, setCallType] = useState<"incoming" | "outgoing">("incoming");
  const [clipPreview, setClipPreview] = useState<ClipData | null>(null);

  const currentUserId = currentUser?.id ?? "100000000000000001";

  const currentUserParticipant = {
    userId: currentUserId,
    muted: selfMuted,
    deafened: selfDeafened,
    speaking: false,
    cameraOn,
    screenSharing,
    displayName: currentUser?.displayName ?? "自分",
    avatar: currentUser?.avatar ?? null,
  };

  const otherParticipants = participants.map((p) => ({
    ...p,
    ...resolveUser(p.userId),
  }));

  const allParticipants = [currentUserParticipant, ...otherParticipants];

  // Suppress unused variable warnings for demo state setters
  void setCallType;
  void setShowCallScreen;

  return (
    <div className="relative flex h-full flex-col bg-discord-bg-tertiary">
      {/* Call screen overlay */}
      {showCallScreen && (
        <div className="absolute inset-0 z-20">
          <CallScreen
            type={callType}
            callerName="花子"
            onAccept={() => setShowCallScreen(false)}
            onDecline={() => setShowCallScreen(false)}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-discord-divider px-4 py-3">
        <h2 className="text-base font-semibold text-discord-header-primary">
          {channelName}
        </h2>
        <div className="flex items-center gap-1 text-discord-text-muted">
          <Users className="h-4 w-4" />
          <span className="text-sm">{allParticipants.length}</span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex min-h-0 flex-1">
        {/* Participant grid */}
        <div className={cn("flex-1 overflow-y-auto p-4", showTextChat && "w-[70%]")}>
          <div className="grid auto-rows-max grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            {allParticipants.map((p, i) => (
              <VoiceParticipantTile
                key={p.userId}
                participant={p}
                isCurrentUser={i === 0}
              />
            ))}
          </div>
        </div>

        {/* Text chat panel */}
        {showTextChat && (
          <div className="w-[30%] min-w-[240px]">
            <TextInVoice channelId={channelId} channelName={channelName} />
          </div>
        )}
      </div>

      {/* Clip preview overlay */}
      {clipPreview && (
        <div className="absolute bottom-20 right-4 z-10">
          <ClipsPreviewCard
            clip={clipPreview}
            onSave={() => setClipPreview(null)}
            onShare={() => setClipPreview(null)}
            onDelete={() => setClipPreview(null)}
          />
        </div>
      )}

      {/* Control bar */}
      <VoiceControlBar
        showTextChat={showTextChat}
        onToggleTextChat={() => setShowTextChat(!showTextChat)}
      />
    </div>
  );
}
