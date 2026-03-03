import type { AuthSessionContextValue } from "@/entities";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

const useAuthSessionMock = vi.hoisted(() =>
  vi.fn<() => AuthSessionContextValue>(() => ({
    status: "authenticated",
    user: null,
    getIdToken: () => Promise.resolve(null),
  })),
);
const ensurePrincipalProvisionedForCurrentUserMock = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      data: {
        principalId: 1,
        firebaseUid: "uid-1",
        requestId: "req-1",
      },
    }),
  ),
);

vi.mock("@/entities", () => ({
  ensurePrincipalProvisionedForCurrentUser: ensurePrincipalProvisionedForCurrentUserMock,
  useAuthSession: useAuthSessionMock,
}));

import { ProtectedPreviewGate } from "./protected-preview-gate";

describe("ProtectedPreviewGate", () => {
  function renderWithQueryClient(node: React.ReactElement): string {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
    );
  }

  afterEach(() => {
    ensurePrincipalProvisionedForCurrentUserMock.mockReset();
    useAuthSessionMock.mockReset();
  });

  test("認証済みかつ guard 未指定なら子要素を描画する", () => {
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: null,
      getIdToken: () => Promise.resolve(null),
    });

    const html = renderWithQueryClient(
      <ProtectedPreviewGate guard={null}>
        <p>protected content</p>
      </ProtectedPreviewGate>,
    );

    expect(html).toContain("protected content");
  });

  test("guard が指定されるとガード画面を描画する", () => {
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: null,
      getIdToken: () => Promise.resolve(null),
    });

    const html = renderWithQueryClient(
      <ProtectedPreviewGate guard="forbidden">
        <p>protected content</p>
      </ProtectedPreviewGate>,
    );

    expect(html).toContain("アクセス権限がありません");
    expect(html).not.toContain("protected content");
  });

  test("認証初期化中は初期化画面を描画する", () => {
    useAuthSessionMock.mockReturnValue({
      status: "initializing",
      user: null,
      getIdToken: () => Promise.resolve(null),
    });

    const html = renderWithQueryClient(
      <ProtectedPreviewGate guard={null}>
        <p>protected content</p>
      </ProtectedPreviewGate>,
    );

    expect(html).toContain("認証状態を確認中です");
    expect(html).not.toContain("protected content");
  });

  test("未認証時はログインガードを描画する", () => {
    useAuthSessionMock.mockReturnValue({
      status: "unauthenticated",
      user: null,
      getIdToken: () => Promise.resolve(null),
    });

    const html = renderWithQueryClient(
      <ProtectedPreviewGate guard={null}>
        <p>protected content</p>
      </ProtectedPreviewGate>,
    );

    expect(html).toContain("ログインが必要です");
    expect(html).not.toContain("protected content");
  });
});
