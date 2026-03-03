"use client";

import { useState } from "react";
import { Hand, PhoneOff, Mic, MicOff } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui/avatar";
import { useVoiceStore } from "@/shared/model/stores/voice-store";

type StageParticipant = {
  userId: string;
  displayName: string;
  avatar: string | null;
  speaking: boolean;
  muted: boolean;
};

const MOCK_SPEAKERS: StageParticipant[] = [];

const MOCK_AUDIENCE: StageParticipant[] = [];

export function StageChannelView({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const [handRaised, setHandRaised] = useState(false);
  const disconnect = useVoiceStore((s) => s.disconnect);

  return (
    <div className="flex h-full flex-col bg-discord-bg-tertiary">
      {/* Header */}
      <div className="border-b border-discord-divider px-4 py-3">
        <h2 className="text-base font-semibold text-discord-header-primary">{channelName}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Speakers section */}
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-discord-channel-default">
            スピーカー — {MOCK_SPEAKERS.length}
          </h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            {MOCK_SPEAKERS.map((speaker) => (
              <div
                key={speaker.userId}
                className="flex flex-col items-center gap-3 rounded-lg bg-discord-bg-secondary p-6"
              >
                <div className="relative">
                  <div
                    className={cn(
                      "rounded-full",
                      speaker.speaking && "animate-voice-ring shadow-[0_0_0_3px_#23A55A]",
                    )}
                  >
                    <Avatar src={speaker.avatar ?? undefined} alt={speaker.displayName} size={80} />
                  </div>
                  {speaker.muted && (
                    <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-discord-btn-danger">
                      <MicOff className="h-3.5 w-3.5 text-white" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {speaker.speaking && <Mic className="h-3.5 w-3.5 text-discord-status-online" />}
                  <span className="text-sm text-discord-text-normal">{speaker.displayName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audience section */}
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-discord-channel-default">
            オーディエンス — {MOCK_AUDIENCE.length}
          </h3>
          <div className="flex flex-wrap gap-4">
            {MOCK_AUDIENCE.map((member) => (
              <div
                key={member.userId}
                className="flex items-center gap-2 rounded-lg bg-discord-bg-secondary px-3 py-2"
              >
                <Avatar src={member.avatar ?? undefined} alt={member.displayName} size={32} />
                <span className="text-sm text-discord-text-normal">{member.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-center gap-3 border-t border-discord-divider px-4 py-3">
        <button
          onClick={() => setHandRaised(!handRaised)}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            handRaised
              ? "bg-discord-brand-blurple text-white"
              : "bg-discord-bg-secondary text-discord-text-normal hover:bg-discord-bg-mod-hover",
          )}
        >
          <Hand className="h-4 w-4" />
          {handRaised ? "手を下げる" : "手を挙げる"}
        </button>
        <button
          onClick={disconnect}
          className="flex items-center gap-2 rounded-full bg-discord-btn-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-discord-btn-danger-hover"
        >
          <PhoneOff className="h-4 w-4" />
          退出
        </button>
      </div>
    </div>
  );
}
