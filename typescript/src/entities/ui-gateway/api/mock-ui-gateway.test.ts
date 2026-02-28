import { describe, expect, test } from "vitest";
import { createMockUiGateway } from "./mock-ui-gateway";

describe("createMockUiGateway", () => {
  test("招待コードの状態に応じて invite 表示内容を返す", async () => {
    const gateway = createMockUiGateway();

    const valid = await gateway.guild.getInvitePageContent("discord-room");
    const invalid = await gateway.guild.getInvitePageContent("invalid-code");
    const expired = await gateway.guild.getInvitePageContent("expired-2026");

    expect(valid.status).toBe("valid");
    expect(valid.primaryAction.href).toContain("/login?redirect=");
    expect(invalid.status).toBe("invalid");
    expect(expired.status).toBe("expired");
  });

  test("会話プレビューにメッセージ状態バリエーションを含む", async () => {
    const gateway = createMockUiGateway();

    const channel = await gateway.message.getChannelContent({
      guildId: "guild-1",
      channelId: "channel-general",
    });

    const states = new Set(channel.messages.map((message) => message.state));
    expect(states.has("failed")).toBe(true);
    expect(states.has("pending")).toBe(true);
    expect(states.has("edited")).toBe(true);
    expect(states.has("deleted")).toBe(true);
  });
});
