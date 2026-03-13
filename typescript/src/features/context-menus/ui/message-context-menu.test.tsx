// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@/test/test-utils";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MessageContextMenu } from "./message-context-menu";

const deleteMutateMock = vi.fn();

vi.mock("@/shared/api/mutations", () => ({
  useDeleteMessage: () => ({
    mutate: deleteMutateMock,
  }),
}));

describe("MessageContextMenu", () => {
  beforeEach(() => {
    deleteMutateMock.mockReset();
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
        contextMenu: null,
        activeMessageEdit: null,
      });
    });
  });

  test("principal_id が Firebase uid と異なっても自分のメッセージ扱いにする", () => {
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
    });

    render(
      <MessageContextMenu
        data={{
          message: {
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
          },
        }}
      />,
    );

    expect(screen.getByRole("menuitem", { name: "メッセージを編集" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "メッセージを報告" })).toBeNull();
  });

  test("削除済みの自分のメッセージでは編集/削除を表示しない", () => {
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
    });

    render(
      <MessageContextMenu
        data={{
          message: {
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
            content: "",
            timestamp: "2026-03-10T10:00:00Z",
            version: "2",
            editedTimestamp: "2026-03-10T10:01:00Z",
            isDeleted: true,
            type: 0,
            pinned: false,
            mentionEveryone: false,
            mentions: [],
            attachments: [],
            embeds: [],
            reactions: [],
            referencedMessage: null,
          },
        }}
      />,
    );

    expect(screen.queryByRole("menuitem", { name: "メッセージを編集" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "メッセージを削除" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "メッセージを報告" })).toBeNull();
  });

  test("未接続の返信とピン留めで info toast を積む", () => {
    render(
      <MessageContextMenu
        data={{
          message: {
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
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "返信" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "ピン留め" }));

    const messages = useUIStore.getState().toasts.map((toast) => toast.message);
    expect(messages).toContain("返信送信は v1 では未接続です。");
    expect(messages).toContain("ピン留め操作は v1 では未接続です。");
  });
});
