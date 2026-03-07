// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import { vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { ChannelContextMenu } from "./channel-context-menu";

const useActionGuardMock = vi.hoisted(() => vi.fn());

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

describe("ChannelContextMenu", () => {
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

  test("opens channel delete modal with channel payload", async () => {
    render(
      <ChannelContextMenu
        data={{
          channel: createChannel(),
          serverId: "2001",
        }}
      />,
    );

    await userEvent.click(screen.getByText("チャンネルを削除"));

    expect(useUIStore.getState().activeModal).toBe("channel-delete");
    expect(useUIStore.getState().modalProps).toMatchObject({
      channelId: "3001",
      channelName: "general",
      serverId: "2001",
    });
  });

  test("disables edit and delete when channel manage permission is missing", async () => {
    useActionGuardMock.mockImplementation(() => ({
      status: "forbidden",
      isAllowed: false,
      message: "この操作を行う権限がありません。",
    }));

    render(
      <ChannelContextMenu
        data={{
          channel: createChannel(),
          serverId: "2001",
        }}
      />,
    );

    expect(screen.getByRole("menuitem", { name: "チャンネルを編集" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("menuitem", { name: "チャンネルを削除" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("menuitem", { name: "招待を作成" })).toHaveProperty("disabled", true);

    await userEvent.click(screen.getByRole("menuitem", { name: "チャンネルを編集" }));
    expect(useUIStore.getState().activeModal).toBeNull();
  });
});
