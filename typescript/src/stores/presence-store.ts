import { create } from "zustand";

export type ActivityType = "playing" | "streaming" | "listening" | "watching" | "competing";

export interface Activity {
  name: string;
  type: ActivityType;
  details?: string;
  state?: string;
}

export interface UserPresence {
  status: "online" | "idle" | "dnd" | "offline";
  customStatus?: string;
  activities?: Activity[];
}

interface PresenceState {
  presences: Record<string, UserPresence>;

  setPresence: (userId: string, presence: UserPresence) => void;
  removePresence: (userId: string) => void;
  getPresence: (userId: string) => UserPresence | undefined;
  bulkSetPresences: (presences: Record<string, UserPresence>) => void;
}

const initialPresences: Record<string, UserPresence> = {
  "100000000000000001": {
    status: "online",
    customStatus: "Working on Discord UI",
    activities: [{ name: "Visual Studio Code", type: "playing" }],
  },
  "100000000000000002": {
    status: "idle",
    activities: [
      { name: "Spotify", type: "listening", details: "Chill Vibes", state: "Lo-Fi Beats" },
    ],
  },
  "100000000000000003": {
    status: "dnd",
    customStatus: "Do not disturb",
  },
  "100000000000000004": {
    status: "online",
    activities: [{ name: "Valorant", type: "playing", details: "Competitive", state: "Ascent" }],
  },
  "100000000000000005": {
    status: "offline",
  },
};

export const usePresenceStore = create<PresenceState>((set, get) => ({
  presences: { ...initialPresences },

  setPresence: (userId, presence) =>
    set((state) => ({
      presences: { ...state.presences, [userId]: presence },
    })),

  removePresence: (userId) =>
    set((state) => {
      const { [userId]: _, ...rest } = state.presences;
      return { presences: rest };
    }),

  getPresence: (userId) => get().presences[userId],

  bulkSetPresences: (presences) =>
    set((state) => ({
      presences: { ...state.presences, ...presences },
    })),
}));
