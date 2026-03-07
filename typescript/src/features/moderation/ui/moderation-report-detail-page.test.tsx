// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { ModerationReportDetailPage } from "./moderation-report-detail-page";

const useActionGuardMock = vi.hoisted(() => vi.fn());
const useModerationReportMock = vi.hoisted(() => vi.fn());

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
    mutateAsync: vi.fn(),
  }),
  useResolveModerationReport: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useReopenModerationReport: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

describe("ModerationReportDetailPage", () => {
  beforeEach(() => {
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
});
