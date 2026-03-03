import { ServerList } from "@/widgets/legacy/ui/server-list";
import { ProfilePopout } from "@/widgets/legacy/ui/user-profile";
import { ContextMenuPortal } from "@/widgets/legacy/ui/context-menus";
import { ModalManager } from "@/widgets/legacy/ui/modals";
import { SkipNav } from "@/shared/ui/legacy/skip-nav";
import { AuthGuard } from "@/widgets/legacy/ui/auth-guard";

export default function ChannelsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen w-screen flex-col overflow-hidden">
        <SkipNav />
        <div className="flex flex-1 min-h-0">
          <ServerList />
          <div className="flex flex-1 min-w-0">{children}</div>
          <ProfilePopout />
          <ContextMenuPortal />
          <ModalManager />
        </div>
      </div>
    </AuthGuard>
  );
}
