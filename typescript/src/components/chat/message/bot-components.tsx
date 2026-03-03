"use client";

import type { ActionRow } from "@/types/bot-components";
import { BotButton } from "./bot-button";
import { BotSelect } from "./bot-select";
import { BotUserSelect } from "./bot-user-select";
import { BotRoleSelect } from "./bot-role-select";
import { BotChannelSelect } from "./bot-channel-select";

export function BotComponents({
  components,
  onButtonClick,
  onSelectChange,
}: {
  components: ActionRow[];
  onButtonClick?: (customId: string) => void;
  onSelectChange?: (customId: string, values: string[]) => void;
}) {
  return (
    <div className="mt-1 flex flex-col gap-1">
      {components.map((row, rowIndex) => (
        <div key={rowIndex} className="flex flex-wrap gap-1">
          {row.components.map((component, compIndex) => {
            if (component.type === 2) {
              return (
                <BotButton
                  key={component.customId ?? compIndex}
                  component={component}
                  onClick={onButtonClick}
                />
              );
            }
            if (component.type === 3) {
              return (
                <BotSelect
                  key={component.customId}
                  component={component}
                  onSelect={onSelectChange}
                />
              );
            }
            if (component.type === 5) {
              return (
                <BotUserSelect
                  key={component.customId}
                  component={component}
                  onSelect={onSelectChange}
                />
              );
            }
            if (component.type === 6) {
              return (
                <BotRoleSelect
                  key={component.customId}
                  component={component}
                  onSelect={onSelectChange}
                />
              );
            }
            if (component.type === 8) {
              return (
                <BotChannelSelect
                  key={component.customId}
                  component={component}
                  onSelect={onSelectChange}
                />
              );
            }
            return null;
          })}
        </div>
      ))}
    </div>
  );
}
