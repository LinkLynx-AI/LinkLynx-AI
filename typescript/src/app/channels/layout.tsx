import { ServerList } from "@/components/server-list";
import { ProfilePopout } from "@/components/user-profile";
import { ContextMenuPortal } from "@/components/context-menus";
import { ModalManager } from "@/components/modals";
import { SkipNav } from "@/components/ui/skip-nav";
import { AuthGuard } from "@/components/auth-guard";

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
