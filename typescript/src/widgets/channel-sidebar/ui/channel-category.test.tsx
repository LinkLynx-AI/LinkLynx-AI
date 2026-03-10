// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { ChannelCategory } from "./channel-category";

describe("ChannelCategory", () => {
  beforeEach(() => {
    useUIStore.setState({
      activeModal: null,
      modalProps: {},
      contextMenu: null,
    });
  });

  test("renders category header as a button instead of a link", async () => {
    const onToggle = vi.fn();

    render(
      <ChannelCategory
        channel={{
          id: "3100",
          guildId: "2001",
          type: 4,
          name: "times",
          topic: null,
          position: 0,
          parentId: null,
          nsfw: false,
          rateLimitPerUser: 0,
          lastMessageId: null,
        }}
        serverId="2001"
        name="times"
        collapsed={false}
        onToggle={onToggle}
        onCreateChannel={vi.fn()}
      >
        <div>child channel</div>
      </ChannelCategory>,
    );

    expect(screen.queryByRole("link", { name: "times" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "times" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
