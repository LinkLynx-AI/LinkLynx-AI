import { describe, it, expect, beforeEach } from "vitest";
import { useNotificationStore } from "./notification-store";

describe("useNotificationStore", () => {
  beforeEach(() => {
    useNotificationStore.setState({
      unreads: {},
      mentions: {},
      mutedChannels: [],
      mutedServers: [],
      suppressEveryone: false,
      suppressRoles: false,
    });
  });

  it("addUnread increments count", () => {
    useNotificationStore.getState().addUnread("channel-1");
    expect(useNotificationStore.getState().getUnreadCount("channel-1")).toBe(1);
    useNotificationStore.getState().addUnread("channel-1", 3);
    expect(useNotificationStore.getState().getUnreadCount("channel-1")).toBe(4);
  });

  it("markAsRead resets count to zero", () => {
    useNotificationStore.getState().addUnread("channel-1", 5);
    useNotificationStore.getState().addMention("channel-1");
    useNotificationStore.getState().markAsRead("channel-1");
    expect(useNotificationStore.getState().getUnreadCount("channel-1")).toBe(0);
    expect(useNotificationStore.getState().getMentionCount("channel-1")).toBe(0);
  });

  it("addMention increments mention count", () => {
    useNotificationStore.getState().addMention("channel-1");
    expect(useNotificationStore.getState().getMentionCount("channel-1")).toBe(1);
    useNotificationStore.getState().addMention("channel-1");
    expect(useNotificationStore.getState().getMentionCount("channel-1")).toBe(2);
  });

  it("toggleMuteChannel toggles mute state", () => {
    expect(useNotificationStore.getState().isChannelMuted("channel-1")).toBe(false);
    useNotificationStore.getState().toggleMuteChannel("channel-1");
    expect(useNotificationStore.getState().isChannelMuted("channel-1")).toBe(true);
    useNotificationStore.getState().toggleMuteChannel("channel-1");
    expect(useNotificationStore.getState().isChannelMuted("channel-1")).toBe(false);
  });

  it("toggleMuteServer toggles server mute", () => {
    useNotificationStore.getState().toggleMuteServer("server-1");
    expect(useNotificationStore.getState().mutedServers).toContain("server-1");
    useNotificationStore.getState().toggleMuteServer("server-1");
    expect(useNotificationStore.getState().mutedServers).not.toContain("server-1");
  });

  it("returns zero for unknown channels", () => {
    expect(useNotificationStore.getState().getUnreadCount("unknown")).toBe(0);
    expect(useNotificationStore.getState().getMentionCount("unknown")).toBe(0);
  });
});
