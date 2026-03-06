// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AnchorHTMLAttributes, PropsWithChildren } from "react";
import { render, screen, userEvent } from "@/test/test-utils";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { ChannelItem } from "./channel-item";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}));

function createChannel() {
  return {
    id: "3001",
    guildId: "2001",
    type: 0 as const,
    name: "general",
    topic: null,
    position: 0,
    parentId: null,
    nsfw: false,
    rateLimitPerUser: 0,
    lastMessageId: null,
  };
}

describe("ChannelItem", () => {
  beforeEach(() => {
    useUIStore.setState({
      activeModal: null,
      modalProps: {},
      contextMenu: null,
    });
  });

  test("opens channel edit modal when settings icon is clicked", async () => {
    render(
      <ChannelItem
        channel={createChannel()}
        serverId="2001"
        isActive={false}
        isUnread={false}
        isMuted={false}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const settingsButton = buttons[1];
    expect(settingsButton).not.toBeUndefined();
    await userEvent.click(settingsButton as HTMLButtonElement);

    expect(useUIStore.getState().activeModal).toBe("channel-edit");
    expect(useUIStore.getState().modalProps).toMatchObject({
      channelId: "3001",
      channelName: "general",
    });
  });
});
