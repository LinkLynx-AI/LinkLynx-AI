import type { ReactNode } from "react";

export type AppShellSlots = {
  headerSlot?: ReactNode;
  sidebarSlot?: ReactNode;
  contentSlot: ReactNode;
};
