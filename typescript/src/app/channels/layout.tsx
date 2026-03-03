import { ServerList } from "@/widgets/server-list";
import { ProfilePopout } from "@/features/user-profile";
import { ContextMenuPortal } from "@/features/context-menus";
import { ModalManager } from "@/features/modals";
import { SkipNav } from "@/shared/ui/skip-nav";
import { AuthGuard } from "@/features/auth-guard";

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
