import { create } from "zustand";
import type { User, UserStatus } from "@/shared/model/legacy/types/user";

type AuthState = {
  currentUser: User | null;
  status: UserStatus;
  customStatus: string | null;

  setCurrentUser: (user: User) => void;
  setStatus: (status: UserStatus) => void;
  setCustomStatus: (text: string | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  status: "online",
  customStatus: null,

  setCurrentUser: (user) => set({ currentUser: user }),
  setStatus: (status) => set({ status }),
  setCustomStatus: (text) => set({ customStatus: text }),
}));
