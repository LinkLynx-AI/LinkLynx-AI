import { ThemeModeChip } from "@/features";
import { APP_NAME, APP_SUBTITLE } from "@/shared/config";
import { AppShellPlaceholder, CorePrimitivesPreview } from "@/widgets";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <AppShellPlaceholder title={APP_NAME} subtitle={APP_SUBTITLE}>
        <ThemeModeChip mode="system" />
      </AppShellPlaceholder>
      <div className="mt-6 w-full max-w-3xl">
        <CorePrimitivesPreview />
      </div>
    </main>
  );
}
