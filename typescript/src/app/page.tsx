import { MemberAvatar } from "@/entities";
import { ThemeToggleButton } from "@/features";
import { AppShellFrame } from "@/widgets";

const demoMember = {
  id: "member-1",
  displayName: "LinkLynx Bot",
  statusLabel: "Online",
  avatarLabel: "LB",
};

export default function Home() {
  return (
    <AppShellFrame
      headerSlot={
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-discord-primary">LinkLynx</h1>
          <ThemeToggleButton currentTheme="dark" disabled />
        </div>
      }
      sidebarSlot={
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Members
          </h2>
          <MemberAvatar member={demoMember} />
        </div>
      }
      contentSlot={
        <article className="space-y-3">
          <h2 className="text-xl font-semibold">FSD Public API Sandbox</h2>
          <p className="text-sm text-white/75">
            v1 UIスライスの雛形を Public API 経由で参照する構成を確認できます。
          </p>
        </article>
      }
    />
  );
}
