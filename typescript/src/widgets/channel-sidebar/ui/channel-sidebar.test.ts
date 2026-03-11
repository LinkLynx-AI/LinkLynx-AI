// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { groupChannelsByCategory } from "./channel-sidebar";

function createChannel({
  id,
  type,
  position,
  parentId = null,
}: {
  id: string;
  type: 0 | 4;
  position: number;
  parentId?: string | null;
}) {
  return {
    id,
    guildId: "2001",
    type,
    name: id,
    topic: null,
    position,
    parentId,
    nsfw: false,
    rateLimitPerUser: 0,
    lastMessageId: null,
  };
}

describe("groupChannelsByCategory", () => {
  test("keeps a leading category before later top-level text channels", () => {
    const groups = groupChannelsByCategory([
      createChannel({ id: "3100", type: 4, position: 0 }),
      createChannel({ id: "3200", type: 0, position: 1, parentId: "3100" }),
      createChannel({ id: "3001", type: 0, position: 10 }),
    ]);

    expect(groups.map((group) => group.category?.id ?? group.channels[0]?.id)).toEqual([
      "3100",
      "3001",
    ]);
    expect(groups[0]?.channels.map((channel) => channel.id)).toEqual(["3200"]);
  });

  test("keeps a leading top-level text channel before later categories", () => {
    const groups = groupChannelsByCategory([
      createChannel({ id: "3001", type: 0, position: 0 }),
      createChannel({ id: "3100", type: 4, position: 10 }),
      createChannel({ id: "3200", type: 0, position: 11, parentId: "3100" }),
    ]);

    expect(groups.map((group) => group.category?.id ?? group.channels[0]?.id)).toEqual([
      "3001",
      "3100",
    ]);
    expect(groups[1]?.channels.map((channel) => channel.id)).toEqual(["3200"]);
  });
});
