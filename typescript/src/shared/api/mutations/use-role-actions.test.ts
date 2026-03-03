// @vitest-environment jsdom
import { renderHook, waitFor } from "@/test/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateRole, useUpdateRole } from "./use-role-actions";
import { createElement } from "react";

const mockCreateRole = vi.fn().mockResolvedValue({
  id: "new-role",
  name: "New Role",
  color: "#ff0000",
  position: 5,
  permissions: 0,
  hoist: false,
  mentionable: false,
  memberCount: 0,
});

const mockUpdateRole = vi.fn().mockResolvedValue({
  id: "role-admin",
  name: "Super Admin",
  color: "#e74c3c",
  position: 4,
  permissions: 0,
  hoist: true,
  mentionable: false,
  memberCount: 2,
});

vi.mock("@/shared/api/api-client", () => ({
  getAPIClient: () => ({
    createRole: mockCreateRole,
    updateRole: mockUpdateRole,
    deleteRole: vi.fn().mockResolvedValue(undefined),
    reorderRoles: vi.fn().mockResolvedValue(undefined),
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useRoleActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useCreateRole calls API", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateRole(), { wrapper });

    result.current.mutate({
      serverId: "server-1",
      data: { name: "New Role", color: "#ff0000" },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockCreateRole).toHaveBeenCalledWith("server-1", {
      name: "New Role",
      color: "#ff0000",
    });

    expect(result.current.data).toMatchObject({
      name: "New Role",
      color: "#ff0000",
    });
  });

  it("useUpdateRole calls API", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateRole(), { wrapper });

    result.current.mutate({
      serverId: "server-1",
      roleId: "role-admin",
      data: { name: "Super Admin" },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockUpdateRole).toHaveBeenCalledWith("server-1", "role-admin", {
      name: "Super Admin",
    });
  });
});
