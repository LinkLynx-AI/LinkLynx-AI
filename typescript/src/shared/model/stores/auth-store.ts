import { create } from "zustand";
import type { User, UserStatus } from "@/shared/model/types/user";

type AuthState = {
  currentUser: User | null;
  currentPrincipalId: string | null;
  status: UserStatus;
  customStatus: string | null;

  setCurrentUser: (user: User) => void;
  clearCurrentUser: () => void;
  setCurrentPrincipalId: (principalId: string | null) => void;
  setStatus: (status: UserStatus) => void;
  setCustomStatus: (text: string | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  currentPrincipalId: null,
  status: "online",
  customStatus: null,

  setCurrentUser: (user) => set({ currentUser: user }),
  clearCurrentUser: () => set({ currentUser: null, currentPrincipalId: null }),
  setCurrentPrincipalId: (principalId) => set({ currentPrincipalId: principalId }),
  setStatus: (status) => set({ status }),
  setCustomStatus: (text) => set({ customStatus: text }),
}));
