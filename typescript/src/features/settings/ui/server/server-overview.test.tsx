// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { ServerOverview } from "./server-overview";

const useServerMock = vi.hoisted(() => vi.fn());
const useUpdateServerMock = vi.hoisted(() => vi.fn());
const mutateAsyncMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/channels/2001",
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock("@/shared/api/queries/use-servers", () => ({
  useServer: useServerMock,
}));

vi.mock("@/shared/api/mutations/use-server-actions", () => ({
  useUpdateServer: useUpdateServerMock,
  useDeleteServer: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

const baseServer = {
  id: "2001",
  name: "LinkLynx Developers",
  icon: null,
  banner: null,
  ownerId: "1001",
  memberCount: 10,
  boostLevel: 0,
  boostCount: 0,
  features: [],
  description: null,
};

describe("ServerOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useServerMock.mockReturnValue({
      data: baseServer,
      isLoading: false,
      isError: false,
      error: null,
    });
    useUpdateServerMock.mockReturnValue({
      isPending: false,
      mutateAsync: mutateAsyncMock,
    });
    mutateAsyncMock.mockResolvedValue(baseServer);
  });

  test("shows validation reason for blank name and blocks submit", async () => {
    render(<ServerOverview serverId="2001" />);

    const nameInput = screen.getByDisplayValue("LinkLynx Developers");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "   ");

    expect(screen.getByText("サーバー名を入力してください。")).not.toBeNull();
    const saveButton = screen.getByRole("button", { name: "変更を保存" });
    expect(saveButton).toHaveProperty("disabled", true);
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  test("submits trimmed name and shows success message", async () => {
    render(<ServerOverview serverId="2001" />);

    const nameInput = screen.getByDisplayValue("LinkLynx Developers");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "  New Guild Name  ");
    await userEvent.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        serverId: "2001",
        data: {
          name: "New Guild Name",
        },
      });
    });
    expect(screen.getByText("サーバー名を保存しました。")).not.toBeNull();
  });

  test("keeps local input while editing even when server data refetches", async () => {
    let serverData = { ...baseServer };
    useServerMock.mockImplementation(() => ({
      data: serverData,
      isLoading: false,
      isError: false,
      error: null,
    }));

    const { rerender } = render(<ServerOverview serverId="2001" />);
    const nameInput = screen.getByDisplayValue("LinkLynx Developers");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Local Draft Name");

    serverData = {
      ...serverData,
      name: "Remote Synced Name",
    };
    rerender(<ServerOverview serverId="2001" />);

    expect(screen.getByDisplayValue("Local Draft Name")).not.toBeNull();
  });

  test("renders danger zone delete action", () => {
    render(<ServerOverview serverId="2001" />);

    expect(screen.getByRole("button", { name: "サーバーを削除" })).not.toBeNull();
  });

  test("does not render non-api-backed server setting controls", () => {
    render(<ServerOverview serverId="2001" />);

    expect(screen.getByText(/サーバー名の変更とサーバー削除のみ/)).not.toBeNull();
    expect(screen.queryByText("サーバーバナー")).toBeNull();
    expect(screen.queryByText("システムメッセージチャンネル")).toBeNull();
    expect(screen.queryByText("AFK チャンネル")).toBeNull();
  });
});
