import type { AuthSessionContextValue } from "@/entities";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

const useAuthSessionMock = vi.hoisted(
  () =>
    vi.fn<() => AuthSessionContextValue>(() => ({
      status: "authenticated",
      user: null,
      getIdToken: async () => null,
    })),
);

vi.mock("@/entities", () => ({
  useAuthSession: useAuthSessionMock,
}));

import { ProtectedPreviewGate } from "./protected-preview-gate";

describe("ProtectedPreviewGate", () => {
  afterEach(() => {
    useAuthSessionMock.mockReset();
  });

  test("認証済みかつ guard 未指定なら子要素を描画する", () => {
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: null,
      getIdToken: async () => null,
    });

    const html = renderToStaticMarkup(
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
      getIdToken: async () => null,
    });

    const html = renderToStaticMarkup(
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
      getIdToken: async () => null,
    });

    const html = renderToStaticMarkup(
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
      getIdToken: async () => null,
    });

    const html = renderToStaticMarkup(
      <ProtectedPreviewGate guard={null}>
        <p>protected content</p>
      </ProtectedPreviewGate>,
    );

    expect(html).toContain("ログインが必要です");
    expect(html).not.toContain("protected content");
  });
});
