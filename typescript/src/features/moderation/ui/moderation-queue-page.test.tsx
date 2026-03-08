// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { ModerationQueuePage } from "./moderation-queue-page";

const useActionGuardMock = vi.hoisted(() => vi.fn());
const useModerationReportsMock = vi.hoisted(() => vi.fn());

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
  useModerationReports: useModerationReportsMock,
}));

vi.mock("@/shared/api/mutations", () => ({
  useCreateModerationReport: () => ({
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

describe("ModerationQueuePage", () => {
  beforeEach(() => {
    useActionGuardMock.mockImplementation(() => ({
      status: "allowed",
      isAllowed: true,
      message: null,
    }));
    useModerationReportsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  test("renders route guard screen when moderation permission is denied", () => {
    useActionGuardMock.mockImplementation(() => ({
      status: "forbidden",
      isAllowed: false,
      message: "この操作を行う権限がありません。",
    }));

    render(<ModerationQueuePage serverId="2001" />);

    expect(screen.getByText("アクセス権限がありません")).not.toBeNull();
  });
});
