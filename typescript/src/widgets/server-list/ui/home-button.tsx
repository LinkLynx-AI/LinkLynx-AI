"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui/tooltip-simple";
import { PillIndicator } from "./pill-indicator";

export function HomeButton() {
  const pathname = usePathname();
  const isActive = pathname === "/channels/me" || pathname?.startsWith("/channels/me/");
  const [isHovered, setIsHovered] = useState(false);

  // TODO: derive from actual unread DM state
  const hasUnreadDM = false;

  const pillState = isActive ? "selected" : isHovered ? "hover" : hasUnreadDM ? "unread" : "none";

  return (
    <div className="relative flex items-center justify-center">
      <PillIndicator state={pillState} />
      <Tooltip content="ダイレクトメッセージ" position="right">
        <Link
          href="/channels/me"
          className={cn(
            "flex h-12 w-12 items-center justify-center transition-all duration-150",
            isActive || isHovered
              ? "rounded-[33%] bg-discord-brand-blurple"
              : "rounded-full bg-discord-bg-primary",
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
            <path
              d="M23.0212 1.67671C21.3107 0.879656 19.5079 0.318797 17.6584 0C17.4062 0.461742 17.1749 0.934541 16.9708 1.4184C15.003 1.12145 12.9974 1.12145 11.0292 1.4184C10.8251 0.934541 10.5765 0.461744 10.3415 0C8.49051 0.321397 6.68553 0.884334 4.97867 1.68381C1.32967 7.01788 0.406602 12.2112 0.868537 17.3326C2.85527 18.8017 5.07564 19.9043 7.43826 20C7.97468 19.2648 8.44653 18.484 8.84913 17.665C8.06801 17.3643 7.31862 16.9891 6.60879 16.5457C6.80895 16.3997 7.00379 16.2488 7.19322 16.0953C11.6698 18.1752 16.4714 18.1752 20.8998 16.0953C21.0914 16.2513 21.2862 16.4022 21.4841 16.5457C20.7727 16.9907 20.0215 17.3672 19.2384 17.6676C19.6419 18.4862 20.1139 19.2672 20.6497 20C23.0147 19.9068 25.2367 18.8042 27.2234 17.3351C27.7647 11.3832 26.2196 6.2371 23.0212 1.67671ZM9.68041 14.2069C8.39776 14.2069 7.34541 13.0271 7.34541 11.5818C7.34541 10.1364 8.37544 8.95399 9.68041 8.95399C10.9854 8.95399 12.0377 10.1339 12.0154 11.5818C12.0178 13.0271 10.9854 14.2069 9.68041 14.2069ZM18.3196 14.2069C17.0369 14.2069 15.9846 13.0271 15.9846 11.5818C15.9846 10.1364 17.0146 8.95399 18.3196 8.95399C19.6246 8.95399 20.6769 10.1339 20.6546 11.5818C20.6546 13.0271 19.6246 14.2069 18.3196 14.2069Z"
              fill="currentColor"
            />
          </svg>
        </Link>
      </Tooltip>
    </div>
  );
}
