import { create } from "zustand";

export type ModalType =
  | "create-server"
  | "join-server"
  | "create-channel"
  | "create-invite"
  | "delete-confirm"
  | "image-lightbox"
  | "file-upload"
  | "keyboard-shortcuts"
  | "quick-switcher"
  | "user-settings"
  | "server-settings"
  | "user-profile"
  | "status-settings"
  | "forward-message"
  | "welcome-screen"
  | "external-link"
  | "nsfw-warning"
  | "file-warning"
  | "channel-edit"
  | "onboarding"
  | "pin-confirm"
  | "reaction-detail"
  | "app-directory"
  | "poll-voters"
  | "server-template"
  | null;

export type RightPanelType =
  | "members"
  | "threads"
  | "search"
  | "pinned"
  | "inbox"
  | null;

interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "error";
}

interface ContextMenuState {
  type: string;
  position: { x: number; y: number };
  data: unknown;
}

interface ProfilePopoutState {
  userId: string;
  position: { x: number; y: number };
}

interface UIState {
  // Sidebar visibility
  memberListVisible: boolean;
  channelSidebarWidth: number;

  // Mode flags
  developerMode: boolean;
  streamerMode: boolean;

  // Active panels
  activeRightPanel: RightPanelType;

  // Modal
  activeModal: ModalType;
  modalProps: Record<string, unknown>;

  // Context menu
  contextMenu: ContextMenuState | null;

  // Profile popout
  profilePopout: ProfilePopoutState | null;

  // Toast notifications
  toasts: Toast[];

  // Actions
  toggleMemberList: () => void;
  setChannelSidebarWidth: (width: number) => void;
  setActiveRightPanel: (panel: RightPanelType) => void;
  openModal: (type: ModalType, props?: Record<string, unknown>) => void;
  closeModal: () => void;
  showContextMenu: (
    type: string,
    position: { x: number; y: number },
    data: unknown
  ) => void;
  hideContextMenu: () => void;
  showProfilePopout: (
    userId: string,
    position: { x: number; y: number }
  ) => void;
  hideProfilePopout: () => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  toggleDeveloperMode: () => void;
  toggleStreamerMode: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  memberListVisible: true,
  channelSidebarWidth: 240,
  developerMode: false,
  streamerMode: false,
  activeRightPanel: null,
  activeModal: null,
  modalProps: {},
  contextMenu: null,
  profilePopout: null,
  toasts: [],

  toggleMemberList: () =>
    set((state) => ({ memberListVisible: !state.memberListVisible })),

  setChannelSidebarWidth: (width) => set({ channelSidebarWidth: width }),

  setActiveRightPanel: (panel) =>
    set((state) => ({
      activeRightPanel: state.activeRightPanel === panel ? null : panel,
    })),

  openModal: (type, props = {}) =>
    set({ activeModal: type, modalProps: props }),

  closeModal: () => set({ activeModal: null, modalProps: {} }),

  showContextMenu: (type, position, data) =>
    set({ contextMenu: { type, position, data } }),

  hideContextMenu: () => set({ contextMenu: null }),

  showProfilePopout: (userId, position) =>
    set({ profilePopout: { userId, position } }),

  hideProfilePopout: () => set({ profilePopout: null }),

  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }],
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  toggleDeveloperMode: () =>
    set((state) => ({ developerMode: !state.developerMode })),

  toggleStreamerMode: () =>
    set((state) => ({ streamerMode: !state.streamerMode })),
}));
