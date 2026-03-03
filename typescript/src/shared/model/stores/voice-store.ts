import { create } from "zustand";

type VoiceParticipant = {
  userId: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
};

type VoiceState = {
  connected: boolean;
  channelId: string | null;
  serverId: string | null;
  selfMuted: boolean;
  selfDeafened: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  participants: VoiceParticipant[];

  connect: (serverId: string, channelId: string) => void;
  disconnect: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  setSpeaking: (userId: string, speaking: boolean) => void;
};

export const useVoiceStore = create<VoiceState>((set) => ({
  connected: false,
  channelId: null,
  serverId: null,
  selfMuted: false,
  selfDeafened: false,
  cameraOn: false,
  screenSharing: false,
  participants: [],

  connect: (serverId, channelId) =>
    set({
      connected: true,
      serverId,
      channelId,
      selfMuted: false,
      selfDeafened: false,
      participants: [
        {
          userId: "100000000000000002",
          muted: false,
          deafened: false,
          speaking: false,
          cameraOn: false,
          screenSharing: false,
        },
        {
          userId: "100000000000000003",
          muted: true,
          deafened: false,
          speaking: false,
          cameraOn: false,
          screenSharing: false,
        },
        {
          userId: "100000000000000004",
          muted: false,
          deafened: false,
          speaking: true,
          cameraOn: false,
          screenSharing: false,
        },
      ],
    }),

  disconnect: () =>
    set({
      connected: false,
      channelId: null,
      serverId: null,
      selfMuted: false,
      selfDeafened: false,
      cameraOn: false,
      screenSharing: false,
      participants: [],
    }),

  toggleMute: () => set((state) => ({ selfMuted: !state.selfMuted })),

  toggleDeafen: () =>
    set((state) => ({
      selfDeafened: !state.selfDeafened,
      selfMuted: !state.selfDeafened ? true : state.selfMuted,
    })),

  toggleCamera: () => set((state) => ({ cameraOn: !state.cameraOn })),

  toggleScreenShare: () => set((state) => ({ screenSharing: !state.screenSharing })),

  setSpeaking: (userId, speaking) =>
    set((state) => ({
      participants: state.participants.map((p) => (p.userId === userId ? { ...p, speaking } : p)),
    })),
}));
