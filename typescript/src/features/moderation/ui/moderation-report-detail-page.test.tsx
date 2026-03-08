// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { ModerationReportDetailPage } from "./moderation-report-detail-page";

const useActionGuardMock = vi.hoisted(() => vi.fn());
const useModerationReportMock = vi.hoisted(() => vi.fn());
const createMuteMutateAsyncMock = vi.hoisted(() => vi.fn());
const resolveReportMutateAsyncMock = vi.hoisted(() => vi.fn());
const reopenReportMutateAsyncMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/queries", () => ({
  useActionGuard: useActionGuardMock,
  getActionGuardScreenKind: (status: string) => {
    if (status === "forbidden") {
      return "forbidden";
    }
    if (status === "unavailable") {
      return "service-unavailable";
    }
    return null;
  },
  useModerationReport: useModerationReportMock,
}));

vi.mock("@/shared/api/mutations", () => ({
  useCreateModerationMute: () => ({
    isPending: false,
    mutateAsync: createMuteMutateAsyncMock,
  }),
  useResolveModerationReport: () => ({
    isPending: false,
    mutateAsync: resolveReportMutateAsyncMock,
  }),
  useReopenModerationReport: () => ({
    isPending: false,
    mutateAsync: reopenReportMutateAsyncMock,
  }),
}));

describe("ModerationReportDetailPage", () => {
  beforeEach(() => {
    createMuteMutateAsyncMock.mockReset();
    resolveReportMutateAsyncMock.mockReset();
    reopenReportMutateAsyncMock.mockReset();
    useActionGuardMock.mockImplementation(() => ({
      status: "allowed",
      isAllowed: true,
      message: null,
    }));
    useModerationReportMock.mockReturnValue({
      data: {
        reportId: "7001",
        targetType: "message",
        targetId: "9001",
        reason: "spam",
        status: "open",
      },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  test("renders service unavailable guard screen when authz is unavailable", () => {
    useActionGuardMock.mockImplementation(() => ({
      status: "unavailable",
      isAllowed: false,
      message: "認可基盤が一時的に利用できません。時間をおいて再試行してください。",
    }));

    render(<ModerationReportDetailPage serverId="2001" reportId="7001" />);

    expect(screen.getByText("認証基盤が一時的に利用できません")).not.toBeNull();
  });

  test("renders report detail and resolves the report", async () => {
    const user = userEvent.setup();

    render(<ModerationReportDetailPage serverId="2001" reportId="7001" />);

    expect(screen.getByText("Report #7001")).not.toBeNull();
    expect(screen.getByText("message:9001")).not.toBeNull();
    expect(screen.getByText("spam")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "resolve" }));

    expect(resolveReportMutateAsyncMock).toHaveBeenCalledWith({
      serverId: "2001",
      reportId: "7001",
    });
  });

  test("submits a mute action for the selected report", async () => {
    const user = userEvent.setup();
    useModerationReportMock.mockReturnValue({
      data: {
        reportId: "7001",
        targetType: "user",
        targetId: "9002",
        reason: "abuse",
        status: "open",
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    createMuteMutateAsyncMock.mockResolvedValue({ muteId: "8001" });

    render(<ModerationReportDetailPage serverId="2001" reportId="7001" />);

    await user.clear(screen.getByLabelText("理由"));
    await user.type(screen.getByLabelText("理由"), "temporary mute");
    await user.type(screen.getByLabelText("期限（任意）"), "2026-04-01T00:00:00Z");
    await user.click(screen.getByRole("button", { name: "mute" }));

    expect(createMuteMutateAsyncMock).toHaveBeenCalledWith({
      serverId: "2001",
      targetUserId: "9002",
      reason: "temporary mute",
      expiresAt: "2026-04-01T00:00:00Z",
    });
  });
});
