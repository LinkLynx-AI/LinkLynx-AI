"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "./avatar";

export type HoverCardUser = {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  status?: "online" | "idle" | "dnd" | "offline";
  customStatus?: string;
  roles?: { name: string; color: string }[];
};

export function HoverCard({
  user,
  children,
  className,
}: {
  user: HoverCardUser;
  children: React.ReactNode;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(null);

  const show = () => {
    timeout.current = setTimeout(() => setVisible(true), 300);
  };

  const hide = () => {
    if (timeout.current) clearTimeout(timeout.current);
    setVisible(false);
  };

  return (
    <div className={cn("relative inline-flex", className)} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className={cn(
            "absolute left-full top-0 z-50 ml-2 w-72 rounded-lg bg-discord-bg-floating shadow-xl",
            "animate-in fade-in-0 zoom-in-95 duration-100",
          )}
        >
          {/* Banner */}
          <div className="h-16 rounded-t-lg bg-discord-brand-blurple" />

          {/* Avatar */}
          <div className="-mt-8 px-4">
            <div className="rounded-full border-4 border-discord-bg-floating">
              <Avatar
                src={user.avatar}
                alt={user.displayName ?? user.username}
                size={80}
                status={user.status}
              />
            </div>
          </div>

          {/* Info */}
          <div className="px-4 pb-4 pt-2">
            <h4 className="text-lg font-bold text-discord-header-primary">
              {user.displayName ?? user.username}
            </h4>
            <p className="text-sm text-discord-text-normal">{user.username}</p>

            {user.customStatus && (
              <p className="mt-2 text-sm text-discord-text-normal">{user.customStatus}</p>
            )}

            {user.roles && user.roles.length > 0 && (
              <div className="mt-3 border-t border-discord-divider pt-3">
                <h5 className="mb-1 text-xs font-bold uppercase text-discord-header-secondary">
                  ロール
                </h5>
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((role) => (
                    <span
                      key={role.name}
                      className="inline-flex items-center gap-1 rounded-full bg-discord-bg-accent px-2 py-0.5 text-xs text-discord-text-normal"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
