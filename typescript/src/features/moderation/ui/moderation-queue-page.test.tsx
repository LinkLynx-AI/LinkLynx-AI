// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { ModerationQueuePage } from "./moderation-queue-page";

const useActionGuardMock = vi.hoisted(() => vi.fn());
const useModerationReportsMock = vi.hoisted(() => vi.fn());
const createReportMutateAsyncMock = vi.hoisted(() => vi.fn());
const resolveReportMutateAsyncMock = vi.hoisted(() => vi.fn());
const reopenReportMutateAsyncMock = vi.hoisted(() => vi.fn());
const fetchNextPageMock = vi.hoisted(() => vi.fn());

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
    mutateAsync: createReportMutateAsyncMock,
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

describe("ModerationQueuePage", () => {
  beforeEach(() => {
    createReportMutateAsyncMock.mockReset();
    resolveReportMutateAsyncMock.mockReset();
    reopenReportMutateAsyncMock.mockReset();
    fetchNextPageMock.mockReset();
    useActionGuardMock.mockImplementation(() => ({
      status: "allowed",
      isAllowed: true,
      message: null,
    }));
    useModerationReportsMock.mockReturnValue({
      data: {
        pages: [
          {
            reports: [],
            pageInfo: {
              nextAfter: null,
              hasMore: false,
              limit: 50,
              status: null,
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      fetchNextPage: fetchNextPageMock,
      hasNextPage: false,
      isFetchingNextPage: false,
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

  test("renders queue items and resolves an open report", async () => {
    const user = userEvent.setup();
    useModerationReportsMock.mockReturnValue({
      data: {
        pages: [
          {
            reports: [
              {
                reportId: "7001",
                targetType: "message",
                targetId: "9001",
                reason: "spam",
                status: "open",
              },
            ],
            pageInfo: {
              nextAfter: null,
              hasMore: false,
              limit: 50,
              status: null,
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      fetchNextPage: fetchNextPageMock,
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    render(<ModerationQueuePage serverId="2001" />);

    expect(screen.getByText("Report #7001")).not.toBeNull();
    expect(screen.getByText("message:9001 / spam")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "resolve" }));

    expect(resolveReportMutateAsyncMock).toHaveBeenCalledWith({
      serverId: "2001",
      reportId: "7001",
    });
  });

  test("renders load more button when next page exists", async () => {
    const user = userEvent.setup();
    useModerationReportsMock.mockReturnValue({
      data: {
        pages: [
          {
            reports: [
              {
                reportId: "7001",
                targetType: "message",
                targetId: "9001",
                reason: "spam",
                status: "open",
              },
            ],
            pageInfo: {
              nextAfter: "2026-03-05T00:00:00Z|7001",
              hasMore: true,
              limit: 50,
              status: null,
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      fetchNextPage: fetchNextPageMock,
      hasNextPage: true,
      isFetchingNextPage: false,
    });

    render(<ModerationQueuePage serverId="2001" />);

    await user.click(screen.getByRole("button", { name: "次を読み込む" }));

    expect(fetchNextPageMock).toHaveBeenCalledTimes(1);
  });

  test("submits a new report from the queue form", async () => {
    const user = userEvent.setup();

    render(<ModerationQueuePage serverId="2001" />);

    await user.type(screen.getByLabelText("対象ID"), "9002");
    await user.type(screen.getByLabelText("理由"), "abuse");
    await user.click(screen.getByRole("button", { name: "通報を作成" }));

    expect(createReportMutateAsyncMock).toHaveBeenCalledWith({
      serverId: "2001",
      targetType: "message",
      targetId: "9002",
      reason: "abuse",
    });
  });
});
