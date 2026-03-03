import { create } from "zustand";

type GuildState = {
  // Currently selected server (null = DM view)
  activeServerId: string | null;
  activeChannelId: string | null;

  // Last visited channel per server
  lastChannelPerServer: Record<string, string>;

  // Collapsed categories per server
  collapsedCategories: Record<string, Set<string>>;

  // Server folders collapsed state
  collapsedFolders: Set<string>;

  // Actions
  setActiveServer: (serverId: string | null) => void;
  setActiveChannel: (channelId: string) => void;
  toggleCategory: (serverId: string, categoryId: string) => void;
  toggleFolder: (folderId: string) => void;
};

export const useGuildStore = create<GuildState>((set) => ({
  activeServerId: null,
  activeChannelId: null,
  lastChannelPerServer: {},
  collapsedCategories: {},
  collapsedFolders: new Set(),

  setActiveServer: (serverId) =>
    set((state) => ({
      activeServerId: serverId,
      activeChannelId: serverId ? (state.lastChannelPerServer[serverId] ?? null) : null,
    })),

  setActiveChannel: (channelId) =>
    set((state) => ({
      activeChannelId: channelId,
      lastChannelPerServer: state.activeServerId
        ? {
            ...state.lastChannelPerServer,
            [state.activeServerId]: channelId,
          }
        : state.lastChannelPerServer,
    })),

  toggleCategory: (serverId, categoryId) =>
    set((state) => {
      const serverCategories = state.collapsedCategories[serverId] ?? new Set<string>();
      const newCategories = new Set(serverCategories);
      if (newCategories.has(categoryId)) {
        newCategories.delete(categoryId);
      } else {
        newCategories.add(categoryId);
      }
      return {
        collapsedCategories: {
          ...state.collapsedCategories,
          [serverId]: newCategories,
        },
      };
    }),

  toggleFolder: (folderId) =>
    set((state) => {
      const newFolders = new Set(state.collapsedFolders);
      if (newFolders.has(folderId)) {
        newFolders.delete(folderId);
      } else {
        newFolders.add(folderId);
      }
      return { collapsedFolders: newFolders };
    }),
}));
