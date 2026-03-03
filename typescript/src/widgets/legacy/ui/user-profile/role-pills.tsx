"use client";

import type { Role } from "@/shared/model/legacy/types/server";

function numberToHex(color: number): string {
  if (color === 0) return "#99aab5";
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function RolePills({ roles }: { roles: Role[] }) {
  if (roles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => {
        const color = numberToHex(role.color);
        return (
          <div
            key={role.id}
            className="flex items-center gap-1 rounded-sm bg-discord-bg-tertiary px-1.5 py-0.5 text-xs"
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-discord-text-normal">{role.name}</span>
          </div>
        );
      })}
    </div>
  );
}
