"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  APP_ROUTES,
  buildSettingsRoute,
  normalizeReturnToPath,
  type SettingsRouteSection,
} from "@/shared/config";
import { cn } from "@/shared/lib/cn";
import { SettingsShellLayout } from "@/widgets/app-shell";

type SettingsNavItem = {
  id: SettingsRouteSection;
  label: string;
};

const USER_SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  { id: "profile", label: "プロフィール" },
  { id: "appearance", label: "外観" },
];

function resolveActiveSection(pathname: string | null): SettingsRouteSection {
  if (pathname === APP_ROUTES.settings.appearance) {
    return "appearance";
  }

  return "profile";
}

/**
 * settings route 用の共通 shell を描画する。
 */
export function SettingsRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = resolveActiveSection(pathname);
  const normalizedReturnTo = normalizeReturnToPath(searchParams.get("returnTo"));
  const closeTarget = normalizedReturnTo ?? APP_ROUTES.channels.me;

  const handleClose = useCallback(() => {
    router.replace(closeTarget);
  }, [closeTarget, router]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      handleClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  function renderCloseButton() {
    return (
      <button
        type="button"
        onClick={handleClose}
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-discord-interactive-normal text-discord-interactive-normal transition-colors hover:border-discord-interactive-hover hover:text-discord-interactive-hover"
        aria-label="設定を閉じる"
      >
        <X size={18} />
      </button>
    );
  }

  const sidebar = (
    <nav className="py-[60px] pr-2 pl-5" aria-label="設定サイドバー">
      <div className="mb-1.5 px-2.5 text-xs font-bold uppercase text-discord-text-muted">
        ユーザー設定
      </div>
      {USER_SETTINGS_NAV_ITEMS.map((item) => {
        const isActive = activeSection === item.id;
        return (
          <Link
            key={item.id}
            href={buildSettingsRoute(item.id, { returnTo: normalizedReturnTo })}
            className={cn(
              "mb-0.5 flex w-full items-center rounded px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-discord-bg-mod-active text-discord-interactive-active"
                : "text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between md:hidden">
        <div>
          <p className="text-xs font-bold uppercase text-discord-header-secondary">ユーザー設定</p>
          <p className="mt-1 text-sm text-discord-text-muted">
            {USER_SETTINGS_NAV_ITEMS.find((item) => item.id === activeSection)?.label}
          </p>
        </div>
        {renderCloseButton()}
      </div>

      <nav className="flex gap-2 overflow-x-auto md:hidden" aria-label="設定メニュー">
        {USER_SETTINGS_NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <Link
              key={item.id}
              href={buildSettingsRoute(item.id, { returnTo: normalizedReturnTo })}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-discord-bg-mod-active text-discord-interactive-active"
                  : "bg-discord-bg-secondary text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );

  return (
    <SettingsShellLayout
      sidebar={sidebar}
      closeRail={
        <div className="flex flex-col items-center gap-2">
          {renderCloseButton()}
          <span className="text-[13px] font-semibold text-discord-interactive-normal">ESC</span>
        </div>
      }
      content={content}
    />
  );
}
