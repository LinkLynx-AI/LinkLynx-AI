import { ThemeModeChip } from "@/features";
import { APP_NAME, APP_SUBTITLE } from "@/shared/config";
import { AppShellPlaceholder } from "@/widgets";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <AppShellPlaceholder title={APP_NAME} subtitle={APP_SUBTITLE}>
        <ThemeModeChip mode="system" />
      </AppShellPlaceholder>
    </main>
  );
}
