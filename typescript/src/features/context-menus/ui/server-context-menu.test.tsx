// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { ServerContextMenu } from "./server-context-menu";

const useActionGuardMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/queries", () => ({
  useActionGuard: useActionGuardMock,
}));

describe("ServerContextMenu", () => {
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

  test("opens create-channel modal in category mode", async () => {
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

    await userEvent.click(screen.getByRole("menuitem", { name: "カテゴリーを作成" }));

    const state = useUIStore.getState();
    expect(state.activeModal).toBe("create-channel");
    expect(state.modalProps).toMatchObject({ serverId: "2001", initialChannelType: 4 });
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

  test("disables guarded actions when permission is missing", async () => {
    useActionGuardMock.mockImplementation(() => ({
      status: "forbidden",
      isAllowed: false,
      message: "この操作を行う権限がありません。",
    }));

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

    const createChannel = screen.getByRole("menuitem", { name: "チャンネルを作成" });
    const createInvite = screen.getByRole("menuitem", { name: "招待を作成" });
    const serverSettings = screen.getByRole("menuitem", { name: "サーバー設定" });

    expect(createChannel).toHaveProperty("disabled", true);
    expect(createInvite).toHaveProperty("disabled", true);
    expect(serverSettings).toHaveProperty("disabled", true);

    await userEvent.click(serverSettings);
    expect(useUIStore.getState().activeModal).toBeNull();
  });
});
