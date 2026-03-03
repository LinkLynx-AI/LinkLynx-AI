"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Music,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";
import { useVoiceStore } from "@/stores/voice-store";
import { SoundboardPanel } from "./soundboard-panel";
import { ClipsRecorder } from "./clips-recorder";

export function VoiceControlBar({
  showTextChat = false,
  onToggleTextChat,
}: {
  showTextChat?: boolean;
  onToggleTextChat?: () => void;
}) {
  const {
    selfMuted,
    selfDeafened,
    cameraOn,
    screenSharing,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    disconnect,
  } = useVoiceStore();
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [clipDuration, setClipDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setClipDuration(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setClipDuration(0);
    timerRef.current = setInterval(() => {
      setClipDuration((prev) => {
        if (prev >= 29) {
          stopRecording();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 border-t border-discord-divider bg-discord-bg-secondary px-4 py-3">
      <Tooltip content={selfMuted ? "ミュート解除" : "ミュート"}>
        <button
          onClick={toggleMute}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
            selfMuted
              ? "bg-discord-bg-tertiary text-discord-btn-danger"
              : "bg-discord-bg-tertiary text-discord-interactive-normal hover:text-discord-interactive-hover",
          )}
          aria-label={selfMuted ? "ミュート解除" : "ミュート"}
        >
          {selfMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
      </Tooltip>

      <Tooltip content={selfDeafened ? "スピーカーミュート解除" : "スピーカーミュート"}>
        <button
          onClick={toggleDeafen}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
            selfDeafened
              ? "bg-discord-bg-tertiary text-discord-btn-danger"
              : "bg-discord-bg-tertiary text-discord-interactive-normal hover:text-discord-interactive-hover",
          )}
          aria-label={selfDeafened ? "スピーカーミュート解除" : "スピーカーミュート"}
        >
          {selfDeafened ? <HeadphoneOff className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
        </button>
      </Tooltip>

      <Tooltip content={cameraOn ? "カメラをオフ" : "カメラをオン"}>
        <button
          onClick={toggleCamera}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
            cameraOn
              ? "bg-discord-btn-success text-white"
              : "bg-discord-bg-tertiary text-discord-interactive-normal hover:text-discord-interactive-hover",
          )}
          aria-label={cameraOn ? "カメラをオフ" : "カメラをオン"}
        >
          {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
      </Tooltip>

      <Tooltip content={screenSharing ? "画面共有を停止" : "画面を共有"}>
        <button
          onClick={toggleScreenShare}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
            screenSharing
              ? "bg-discord-brand-blurple text-white"
              : "bg-discord-bg-tertiary text-discord-interactive-normal hover:text-discord-interactive-hover",
          )}
          aria-label={screenSharing ? "画面共有を停止" : "画面を共有"}
        >
          <Monitor className="h-5 w-5" />
        </button>
      </Tooltip>

      {/* Clips recorder */}
      <ClipsRecorder
        isRecording={isRecording}
        duration={clipDuration}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
      />

      <div className="relative">
        <Tooltip content="サウンドボード">
          <button
            onClick={() => setSoundboardOpen(!soundboardOpen)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
              soundboardOpen
                ? "bg-discord-brand-blurple text-white"
                : "bg-discord-bg-tertiary text-discord-interactive-normal hover:text-discord-interactive-hover",
            )}
            aria-label="サウンドボード"
          >
            <Music className="h-5 w-5" />
          </button>
        </Tooltip>
        {soundboardOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2">
            <SoundboardPanel onClose={() => setSoundboardOpen(false)} />
          </div>
        )}
      </div>

      {/* Text chat toggle */}
      <Tooltip content={showTextChat ? "テキストチャットを閉じる" : "テキストチャット"}>
        <button
          onClick={onToggleTextChat}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
            showTextChat
              ? "bg-discord-brand-blurple text-white"
              : "bg-discord-bg-tertiary text-discord-interactive-normal hover:text-discord-interactive-hover",
          )}
          aria-label={showTextChat ? "テキストチャットを閉じる" : "テキストチャット"}
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      </Tooltip>

      <Tooltip content="切断">
        <button
          onClick={disconnect}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-discord-btn-danger text-white transition-colors hover:bg-discord-btn-danger/80"
          aria-label="切断"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </Tooltip>
    </div>
  );
}
