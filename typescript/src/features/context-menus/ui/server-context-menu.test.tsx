// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { ServerContextMenu } from "./server-context-menu";

describe("ServerContextMenu", () => {
  test("opens create-channel modal with selected server id", async () => {
    useUIStore.setState({
      activeModal: null,
      modalProps: {},
      contextMenu: {
        type: "server",
        position: { x: 0, y: 0 },
        data: {},
      },
    });

    render(
      <ServerContextMenu
        data={{
          server: {
            id: "2001",
            name: "LinkLynx Developers",
            icon: null,
            banner: null,
            ownerId: "1001",
            memberCount: 1,
            boostLevel: 0,
            boostCount: 0,
            features: [],
            description: null,
          },
        }}
      />,
    );

    await userEvent.click(screen.getByRole("menuitem", { name: "チャンネルを作成" }));

    const state = useUIStore.getState();
    expect(state.activeModal).toBe("create-channel");
    expect(state.modalProps).toMatchObject({ serverId: "2001" });
    expect(state.contextMenu).toBeNull();
  });

  test("opens server-settings modal with selected server id", async () => {
    useUIStore.setState({
      activeModal: null,
      modalProps: {},
      contextMenu: {
        type: "server",
        position: { x: 0, y: 0 },
        data: {},
      },
    });

    render(
      <ServerContextMenu
        data={{
          server: {
            id: "2001",
            name: "LinkLynx Developers",
            icon: null,
            banner: null,
            ownerId: "1001",
            memberCount: 1,
            boostLevel: 0,
            boostCount: 0,
            features: [],
            description: null,
          },
        }}
      />,
    );

    await userEvent.click(screen.getByRole("menuitem", { name: "サーバー設定" }));

    const state = useUIStore.getState();
    expect(state.activeModal).toBe("server-settings");
    expect(state.modalProps).toMatchObject({ serverId: "2001" });
    expect(state.contextMenu).toBeNull();
  });
});
