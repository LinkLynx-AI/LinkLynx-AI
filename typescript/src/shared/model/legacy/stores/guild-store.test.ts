import { useGuildStore } from "./guild-store";

describe("useGuildStore", () => {
  beforeEach(() => {
    useGuildStore.setState({
      activeServerId: null,
      activeChannelId: null,
      lastChannelPerServer: {},
      collapsedCategories: {},
      collapsedFolders: new Set(),
    });
  });

  it("sets active server", () => {
    useGuildStore.getState().setActiveServer("server-1");
    expect(useGuildStore.getState().activeServerId).toBe("server-1");
  });

  it("sets active channel and remembers last channel per server", () => {
    useGuildStore.getState().setActiveServer("server-1");
    useGuildStore.getState().setActiveChannel("channel-1");
    expect(useGuildStore.getState().activeChannelId).toBe("channel-1");
    expect(useGuildStore.getState().lastChannelPerServer["server-1"]).toBe("channel-1");
  });

  it("restores last channel when switching back to server", () => {
    useGuildStore.getState().setActiveServer("server-1");
    useGuildStore.getState().setActiveChannel("channel-1");
    useGuildStore.getState().setActiveServer("server-2");
    useGuildStore.getState().setActiveServer("server-1");
    expect(useGuildStore.getState().activeChannelId).toBe("channel-1");
  });

  it("toggles category collapsed state", () => {
    useGuildStore.getState().toggleCategory("server-1", "cat-1");
    expect(useGuildStore.getState().collapsedCategories["server-1"]?.has("cat-1")).toBe(true);

    useGuildStore.getState().toggleCategory("server-1", "cat-1");
    expect(useGuildStore.getState().collapsedCategories["server-1"]?.has("cat-1")).toBe(false);
  });

  it("clears channel when setting server to null", () => {
    useGuildStore.getState().setActiveServer("server-1");
    useGuildStore.getState().setActiveChannel("channel-1");
    useGuildStore.getState().setActiveServer(null);
    expect(useGuildStore.getState().activeServerId).toBeNull();
    expect(useGuildStore.getState().activeChannelId).toBeNull();
  });
});
