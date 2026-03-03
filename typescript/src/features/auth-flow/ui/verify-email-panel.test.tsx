// @vitest-environment jsdom
import type {
  AuthActionResult,
  AuthSessionContextValue,
  AuthUser,
  PrincipalProvisionResult,
} from "@/entities";
import { act, fireEvent, render, screen } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const useAuthSessionMock = vi.hoisted(() =>
  vi.fn<() => AuthSessionContextValue>(() => ({
    status: "authenticated",
    user: {
      uid: "uid-1",
      email: "verify@example.com",
      emailVerified: false,
    },
    getIdToken: () => Promise.resolve("token-1"),
  })),
);
const reloadCurrentAuthUserMock = vi.hoisted(() =>
  vi.fn<() => Promise<AuthActionResult<AuthUser>>>(() =>
    Promise.resolve({
      ok: true,
      data: {
        uid: "uid-1",
        email: "verify@example.com",
        emailVerified: false,
      },
    }),
  ),
);
const ensurePrincipalProvisionedForCurrentUserMock = vi.hoisted(() =>
  vi.fn<() => Promise<PrincipalProvisionResult>>(() =>
    Promise.resolve({
      ok: true,
      data: {
        principalId: 1,
        firebaseUid: "uid-1",
        requestId: "req-1",
      },
    }),
  ),
);
const sendVerificationEmailForCurrentUserMock = vi.hoisted(() =>
  vi.fn<() => Promise<AuthActionResult<null>>>(() => Promise.resolve({ ok: true, data: null })),
);
const locationAssignMock = vi.hoisted(() => vi.fn());

vi.mock("@/entities", () => ({
  useAuthSession: useAuthSessionMock,
  reloadCurrentAuthUser: reloadCurrentAuthUserMock,
  ensurePrincipalProvisionedForCurrentUser: ensurePrincipalProvisionedForCurrentUserMock,
  sendVerificationEmailForCurrentUser: sendVerificationEmailForCurrentUserMock,
}));

import { VerifyEmailPanel } from "./verify-email-panel";

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
}

async function advanceTime(milliseconds: number) {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
    await Promise.resolve();
  });
}

async function advanceByPollingSteps(steps: number) {
  for (let index = 0; index < steps; index += 1) {
    await advanceTime(5_000);
  }
}

describe("VerifyEmailPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T00:00:00.000Z"));
    vi.spyOn(window.location, "assign").mockImplementation(locationAssignMock);
    setDocumentHidden(false);
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: {
        uid: "uid-1",
        email: "verify@example.com",
        emailVerified: false,
      },
      getIdToken: () => Promise.resolve("token-1"),
    });
    reloadCurrentAuthUserMock.mockResolvedValue({
      ok: true,
      data: {
        uid: "uid-1",
        email: "verify@example.com",
        emailVerified: false,
      },
    });
    ensurePrincipalProvisionedForCurrentUserMock.mockResolvedValue({
      ok: true,
      data: {
        principalId: 1,
        firebaseUid: "uid-1",
        requestId: "req-1",
      },
    });
    sendVerificationEmailForCurrentUserMock.mockResolvedValue({
      ok: true,
      data: null,
    });
    locationAssignMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  function renderPanel() {
    render(
      <VerifyEmailPanel initialEmail="verify@example.com" initialSent={null} returnTo={null} />,
    );
  }

  test("5秒ごとの自動確認で reloadCurrentAuthUser を呼び出す", async () => {
    renderPanel();

    expect(reloadCurrentAuthUserMock).not.toHaveBeenCalled();

    await advanceTime(5_000);
    expect(reloadCurrentAuthUserMock).toHaveBeenCalledTimes(1);

    await advanceTime(5_000);
    expect(reloadCurrentAuthUserMock).toHaveBeenCalledTimes(2);
  });

  test("確認完了を検知すると principal 確保後に channels へ遷移する", async () => {
    reloadCurrentAuthUserMock.mockResolvedValue({
      ok: true,
      data: {
        uid: "uid-1",
        email: "verify@example.com",
        emailVerified: true,
      },
    });

    renderPanel();
    await advanceTime(5_000);

    expect(ensurePrincipalProvisionedForCurrentUserMock).toHaveBeenCalledWith({
      forceRefresh: true,
    });
    expect(locationAssignMock).toHaveBeenCalledWith("/channels/me");

    await advanceByPollingSteps(2);
    expect(reloadCurrentAuthUserMock).toHaveBeenCalledTimes(1);
  });

  test("focus と visibilitychange(visible) で即時再確認する", async () => {
    renderPanel();

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    expect(reloadCurrentAuthUserMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(reloadCurrentAuthUserMock).toHaveBeenCalledTimes(1);

    await advanceTime(1_000);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(reloadCurrentAuthUserMock).toHaveBeenCalledTimes(2);
  });

  test("非表示タブ中はポーリングせず、可視化時に即時再確認する", async () => {
    setDocumentHidden(true);
    renderPanel();

    await advanceTime(5_000);
    expect(reloadCurrentAuthUserMock).not.toHaveBeenCalled();

    setDocumentHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(reloadCurrentAuthUserMock).toHaveBeenCalledTimes(1);
  });

  test("自動確認でエラー発生時に通知しつつ次周期で再試行する", async () => {
    reloadCurrentAuthUserMock
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "network-request-failed",
          message: "network down",
          firebaseCode: "network-request-failed",
        },
      })
      .mockResolvedValue({
        ok: true,
        data: {
          uid: "uid-1",
          email: "verify@example.com",
          emailVerified: false,
        },
      });

    renderPanel();
    await advanceTime(5_000);

    expect(
      screen.getByText("ネットワークエラーが発生しました。接続を確認して再試行してください。"),
    ).toBeTruthy();

    await advanceTime(5_000);
    expect(reloadCurrentAuthUserMock).toHaveBeenCalledTimes(2);
  });

  test("5分上限で自動確認を停止して手動フォールバック通知を表示する", async () => {
    renderPanel();
    await advanceByPollingSteps(60);

    expect(
      screen.getByText(
        "自動確認を停止しました。必要な場合は「確認状態を更新」を押して再確認してください。",
      ),
    ).toBeTruthy();

    const reloadCallCountAtTimeout = reloadCurrentAuthUserMock.mock.calls.length;
    await advanceByPollingSteps(2);
    expect(reloadCurrentAuthUserMock).toHaveBeenCalledTimes(reloadCallCountAtTimeout);
  });

  test("確認状態を更新ボタンはフォールバックとして引き続き利用できる", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "確認状態を更新" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(reloadCurrentAuthUserMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        "まだ確認が完了していません。メール内リンクを開いた後に再度更新してください。",
      ),
    ).toBeTruthy();
  });
});
