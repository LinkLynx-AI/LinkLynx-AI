"use client";

import { useUIStore } from "@/stores/ui-store";
import { MemberList } from "./member-list";

export function MemberListPanel() {
  const visible = useUIStore((s) => s.memberListVisible);
  if (!visible) return null;
  return <MemberList />;
}
