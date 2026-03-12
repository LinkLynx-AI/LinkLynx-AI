import { create } from "zustand";

export type ThemeMode = "dark" | "light";

type SettingsState = {
  theme: ThemeMode;
  compactMode: boolean;
  fontSize: number;
  messageGroupSpacing: number;
  showTimestamps: boolean;
  use24HourTime: boolean;
  enableReducedMotion: boolean;
  enableHighContrast: boolean;

  setTheme: (theme: ThemeMode) => void;
  toggleCompactMode: () => void;
  setFontSize: (size: number) => void;
  setMessageGroupSpacing: (spacing: number) => void;
  toggleTimestamps: () => void;
  toggle24HourTime: () => void;
  toggleReducedMotion: () => void;
  toggleHighContrast: () => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "dark",
  compactMode: false,
  fontSize: 16,
  messageGroupSpacing: 16,
  showTimestamps: true,
  use24HourTime: false,
  enableReducedMotion: false,
  enableHighContrast: false,

  setTheme: (theme) => set({ theme }),

  toggleCompactMode: () => set((state) => ({ compactMode: !state.compactMode })),

  setFontSize: (size) => set({ fontSize: Math.min(24, Math.max(12, size)) }),

  setMessageGroupSpacing: (spacing) =>
    set({ messageGroupSpacing: Math.min(20, Math.max(0, spacing)) }),

  toggleTimestamps: () => set((state) => ({ showTimestamps: !state.showTimestamps })),

  toggle24HourTime: () => set((state) => ({ use24HourTime: !state.use24HourTime })),

  toggleReducedMotion: () => set((state) => ({ enableReducedMotion: !state.enableReducedMotion })),

  toggleHighContrast: () => set((state) => ({ enableHighContrast: !state.enableHighContrast })),
}));
