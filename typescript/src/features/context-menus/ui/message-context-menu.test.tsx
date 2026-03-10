// @vitest-environment jsdom
import { render, screen } from "@/test/test-utils";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { afterEach, describe, expect, test } from "vitest";
import { MessageContextMenu } from "./message-context-menu";

describe("MessageContextMenu", () => {
  afterEach(() => {
    useAuthStore.setState({
      currentUser: null,
      currentPrincipalId: null,
      status: "online",
      customStatus: null,
    });
  });

  test("principal_id が Firebase uid と異なっても自分のメッセージ扱いにする", () => {
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
});
