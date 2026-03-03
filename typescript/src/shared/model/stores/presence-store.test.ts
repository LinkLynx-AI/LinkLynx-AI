import { describe, it, expect, beforeEach } from "vitest";
import { usePresenceStore } from "./presence-store";

describe("usePresenceStore", () => {
  beforeEach(() => {
    usePresenceStore.setState({
      presences: {
        "100000000000000001": {
          status: "online",
          customStatus: "Working on Discord UI",
          activities: [{ name: "Visual Studio Code", type: "playing" }],
        },
        "100000000000000002": {
          status: "idle",
          activities: [
            { name: "Spotify", type: "listening", details: "Chill Vibes", state: "Lo-Fi Beats" },
          ],
        },
        "100000000000000003": { status: "dnd", customStatus: "Do not disturb" },
        "100000000000000004": {
          status: "online",
          activities: [
            { name: "Valorant", type: "playing", details: "Competitive", state: "Ascent" },
          ],
        },
        "100000000000000005": { status: "offline" },
      },
    });
  });

  it("has initial mock presences", () => {
    const { presences } = usePresenceStore.getState();
    expect(Object.keys(presences)).toHaveLength(5);
    expect(presences["100000000000000001"].status).toBe("online");
    expect(presences["100000000000000003"].status).toBe("dnd");
    expect(presences["100000000000000005"].status).toBe("offline");
  });

  it("setPresence updates user presence", () => {
    usePresenceStore.getState().setPresence("100000000000000001", {
      status: "dnd",
      customStatus: "Busy coding",
    });
    const presence = usePresenceStore.getState().presences["100000000000000001"];
    expect(presence.status).toBe("dnd");
    expect(presence.customStatus).toBe("Busy coding");
  });

  it("removePresence removes user", () => {
    usePresenceStore.getState().removePresence("100000000000000005");
    expect(usePresenceStore.getState().presences["100000000000000005"]).toBeUndefined();
    expect(Object.keys(usePresenceStore.getState().presences)).toHaveLength(4);
  });

  it("bulkSetPresences sets multiple presences", () => {
    usePresenceStore.getState().bulkSetPresences({
      "user-a": { status: "online" },
      "user-b": { status: "idle" },
    });
    const { presences } = usePresenceStore.getState();
    expect(presences["user-a"].status).toBe("online");
    expect(presences["user-b"].status).toBe("idle");
    // Original presences still exist
    expect(presences["100000000000000001"].status).toBe("online");
  });

  it("getPresence returns presence for existing user", () => {
    const presence = usePresenceStore.getState().getPresence("100000000000000002");
    expect(presence?.status).toBe("idle");
  });

  it("getPresence returns undefined for unknown user", () => {
    const presence = usePresenceStore.getState().getPresence("unknown-user");
    expect(presence).toBeUndefined();
  });
});
