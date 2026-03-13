// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { useUIStore } from "@/shared/model/stores/ui-store";
import type { Message as MessageType } from "@/shared/model/types";
import { Message } from "./message";

const editMutateMock = vi.fn();
const deleteMutateMock = vi.fn();

vi.mock("@/shared/api/mutations/use-edit-message", () => ({
  useEditMessage: () => ({
    mutate: editMutateMock,
  }),
}));

vi.mock("@/shared/api/mutations/use-message-actions", () => ({
  useDeleteMessage: () => ({
    mutate: deleteMutateMock,
  }),
}));

function buildMessage(overrides: Partial<MessageType> = {}): MessageType {
  return {
    id: "5001",
    channelId: "3001",
    author: {
      id: "9003",
      username: "alice",
      displayName: "Alice",
      avatar: null,
      status: "online",
      customStatus: null,
      bot: false,
    },
    content: "hello",
    timestamp: "2026-03-10T10:00:00Z",
    version: "1",
    editedTimestamp: null,
    isDeleted: false,
    type: 0,
    pinned: false,
    mentionEveryone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    referencedMessage: null,
    ...overrides,
  };
}

describe("Message", () => {
  beforeEach(() => {
    editMutateMock.mockReset();
    deleteMutateMock.mockReset();
    act(() => {
      useAuthStore.setState({
        currentUser: {
          id: "firebase-uid-1",
          username: "alice",
          displayName: "Alice",
          avatar: null,
          status: "online",
          customStatus: null,
          bot: false,
        },
        currentPrincipalId: "9003",
        status: "online",
        customStatus: null,
      });
      useUIStore.setState({
        activeMessageEdit: null,
        contextMenu: null,
        profilePopout: null,
        toasts: [],
      });
    });
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({
        currentUser: null,
        currentPrincipalId: null,
        status: "online",
        customStatus: null,
      });
      useUIStore.setState({
        activeMessageEdit: null,
        contextMenu: null,
        profilePopout: null,
        toasts: [],
      });
    });
  });

  test("削除済みメッセージを tombstone 表示する", () => {
    render(<Message message={buildMessage({ content: "", isDeleted: true })} isGrouped={false} />);

    expect(screen.getByText("メッセージは削除されました。")).toBeTruthy();
    expect(screen.queryByText("(編集済み)")).toBeNull();
  });

  test("自分のメッセージにだけ編集導線を表示する", () => {
    const { rerender, container } = render(<Message message={buildMessage()} isGrouped={false} />);

    fireEvent.mouseEnter(container.firstChild as Element);
    expect(screen.getByTitle("編集")).toBeTruthy();
    expect(screen.getByTitle("削除")).toBeTruthy();

    rerender(
      <Message
        message={buildMessage({ author: { ...buildMessage().author, id: "other-user" } })}
        isGrouped={false}
      />,
    );
    fireEvent.mouseEnter(container.firstChild as Element);
    expect(screen.queryByTitle("編集")).toBeNull();
    expect(screen.queryByTitle("削除")).toBeNull();
  });

  test("未接続のリアクション追加と返信で info toast を積む", () => {
    const { container } = render(<Message message={buildMessage()} isGrouped={false} />);

    fireEvent.mouseEnter(container.firstChild as Element);
    fireEvent.click(screen.getByTitle("リアクションを追加"));
    fireEvent.click(screen.getByTitle("返信"));

    const messages = useUIStore.getState().toasts.map((toast) => toast.message);
    expect(messages).toContain("リアクション追加は v1 では未接続です。");
    expect(messages).toContain("返信送信は v1 では未接続です。");
  });
});
