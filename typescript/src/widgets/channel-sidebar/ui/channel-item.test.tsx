// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AnchorHTMLAttributes, PropsWithChildren } from "react";
import { render, screen, userEvent } from "@/test/test-utils";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { ChannelItem } from "./channel-item";

const useActionGuardMock = vi.hoisted(() => vi.fn());

vi.mock("next/link", () => ({
  default: ({ children, ...props }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/shared/api/queries", () => ({
  useActionGuard: useActionGuardMock,
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
    useActionGuardMock.mockImplementation(() => ({
      status: "allowed",
      isAllowed: true,
      message: null,
    }));
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

    const settingsButton = screen.getByRole("button", { name: "チャンネルを編集" });
    await userEvent.click(settingsButton);

    expect(useUIStore.getState().activeModal).toBe("channel-edit");
    expect(useUIStore.getState().modalProps).toMatchObject({
      channelId: "3001",
      channelName: "general",
    });
  });

  test("keeps edit shortcut disabled while permission is unresolved", () => {
    useActionGuardMock.mockImplementation(() => ({
      status: "loading",
      isAllowed: false,
      message: "権限を確認中です。",
    }));

    render(
      <ChannelItem
        channel={createChannel()}
        serverId="2001"
        isActive={false}
        isUnread={false}
        isMuted={false}
      />,
    );

    expect(screen.getByRole("button", { name: "招待を作成" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "チャンネルを編集" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
