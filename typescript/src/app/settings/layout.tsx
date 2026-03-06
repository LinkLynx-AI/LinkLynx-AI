import { AuthGuard } from "@/features/auth-guard";
import { SettingsRouteShell } from "./_components";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SettingsRouteShell>{children}</SettingsRouteShell>
    </AuthGuard>
  );
}
