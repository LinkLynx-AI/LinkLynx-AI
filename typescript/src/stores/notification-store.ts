import { create } from "zustand";

interface NotificationState {
  unreads: Record<string, number>;
  mentions: Record<string, number>;
  mutedChannels: string[];
  mutedServers: string[];
  suppressEveryone: boolean;
  suppressRoles: boolean;

  markAsRead: (channelId: string) => void;
  addUnread: (channelId: string, count?: number) => void;
  addMention: (channelId: string) => void;
  toggleMuteChannel: (channelId: string) => void;
  toggleMuteServer: (serverId: string) => void;
  getUnreadCount: (channelId: string) => number;
  getMentionCount: (channelId: string) => number;
  isChannelMuted: (channelId: string) => boolean;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreads: {},
  mentions: {},
  mutedChannels: [],
  mutedServers: [],
  suppressEveryone: false,
  suppressRoles: false,

  markAsRead: (channelId) =>
    set((state) => {
      const { [channelId]: _u, ...restUnreads } = state.unreads;
      const { [channelId]: _m, ...restMentions } = state.mentions;
      return { unreads: restUnreads, mentions: restMentions };
    }),

  addUnread: (channelId, count = 1) =>
    set((state) => ({
      unreads: {
        ...state.unreads,
        [channelId]: (state.unreads[channelId] ?? 0) + count,
      },
    })),

  addMention: (channelId) =>
    set((state) => ({
      mentions: {
        ...state.mentions,
        [channelId]: (state.mentions[channelId] ?? 0) + 1,
      },
    })),

  toggleMuteChannel: (channelId) =>
    set((state) => {
      const idx = state.mutedChannels.indexOf(channelId);
      if (idx >= 0) {
        return {
          mutedChannels: state.mutedChannels.filter((id) => id !== channelId),
        };
      }
      return { mutedChannels: [...state.mutedChannels, channelId] };
    }),

  toggleMuteServer: (serverId) =>
    set((state) => {
      const idx = state.mutedServers.indexOf(serverId);
      if (idx >= 0) {
        return {
          mutedServers: state.mutedServers.filter((id) => id !== serverId),
        };
      }
      return { mutedServers: [...state.mutedServers, serverId] };
    }),

  getUnreadCount: (channelId) => get().unreads[channelId] ?? 0,

  getMentionCount: (channelId) => get().mentions[channelId] ?? 0,

  isChannelMuted: (channelId) => get().mutedChannels.includes(channelId),
}));
