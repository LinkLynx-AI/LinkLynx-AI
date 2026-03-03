import { describe, expect, test } from "vitest";
import type { Channel } from "@/shared/model/types/channel";
import { findFirstTextChannel, resolveServerPageDisplayState } from "./page-state";

function createChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: "3001",
    type: 0,
    guildId: "2001",
    name: "general",
    topic: null,
    position: 0,
    parentId: null,
    nsfw: false,
    rateLimitPerUser: 0,
    lastMessageId: null,
    ...overrides,
  };
}

describe("channels/[serverId]/page", () => {
  test("selects first text channel by position", () => {
    const first = createChannel({ id: "3002", type: 2, position: 0 });
    const second = createChannel({ id: "3001", type: 0, position: 5 });
    const third = createChannel({ id: "3003", type: 0, position: 2 });

    const selected = findFirstTextChannel([first, second, third]);

    expect(selected?.id).toBe("3003");
  });

  test("uses id as tie-breaker when text channel positions are equal", () => {
    const first = createChannel({ id: "3002", type: 0, position: 1 });
    const second = createChannel({ id: "3001", type: 0, position: 1 });

    const selected = findFirstTextChannel([first, second]);

    expect(selected?.id).toBe("3001");
  });

  test("returns null when no text channel exists", () => {
    const channels = [
      createChannel({ id: "3002", type: 2, position: 0 }),
      createChannel({ id: "3004", type: 4, position: 1 }),
    ];

    expect(findFirstTextChannel(channels)).toBeNull();
  });

  test("returns loading state while query is in-flight", () => {
    expect(
      resolveServerPageDisplayState({
        channels: undefined,
        isLoading: true,
        isError: false,
      }),
    ).toBe("loading");
  });

  test("returns error state when query fails", () => {
    expect(
      resolveServerPageDisplayState({
        channels: undefined,
        isLoading: false,
        isError: true,
      }),
    ).toBe("error");
  });

  test("returns redirect-or-idle state when a text channel exists", () => {
    expect(
      resolveServerPageDisplayState({
        channels: [createChannel({ id: "3001", type: 0, position: 1 })],
        isLoading: false,
        isError: false,
      }),
    ).toBe("redirect-or-idle");
  });

  test("returns empty state when channel list has no text channel", () => {
    expect(
      resolveServerPageDisplayState({
        channels: [
          createChannel({ id: "3002", type: 2, position: 0 }),
          createChannel({ id: "3004", type: 4, position: 1 }),
        ],
        isLoading: false,
        isError: false,
      }),
    ).toBe("empty");
  });

  test("prefers redirect-or-idle when stale channels exist even if refetch errored", () => {
    expect(
      resolveServerPageDisplayState({
        channels: [createChannel({ id: "3001", type: 0, position: 1 })],
        isLoading: false,
        isError: true,
      }),
    ).toBe("redirect-or-idle");
  });

  test("prefers empty when stale channels exist without text channels even if refetch errored", () => {
    expect(
      resolveServerPageDisplayState({
        channels: [
          createChannel({ id: "3002", type: 2, position: 0 }),
          createChannel({ id: "3004", type: 4, position: 1 }),
        ],
        isLoading: false,
        isError: true,
      }),
    ).toBe("empty");
  });
});
