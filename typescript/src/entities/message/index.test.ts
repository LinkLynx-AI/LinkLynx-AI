import { describe, expect, test } from "vitest";
import { groupConsecutiveMessages, type Message } from "@/entities/message";

function createMessage(message: Message): Message {
  return message;
}

describe("groupConsecutiveMessages", () => {
  test("同一送信者かつ5分以内の連投を同一グループにまとめる", () => {
    const messages: Message[] = [
      createMessage({
        id: "m1",
        senderId: "alice",
        senderName: "Alice",
        body: "最初の投稿",
        sentAt: "2025-01-01T10:00:00.000Z",
      }),
      createMessage({
        id: "m2",
        senderId: "alice",
        senderName: "Alice",
        body: "5分ちょうど",
        sentAt: "2025-01-01T10:05:00.000Z",
      }),
      createMessage({
        id: "m3",
        senderId: "alice",
        senderName: "Alice",
        body: "5分超過",
        sentAt: "2025-01-01T10:10:01.000Z",
      }),
    ];

    const groups = groupConsecutiveMessages(messages);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.messages.map((message) => message.id)).toEqual(["m1", "m2"]);
    expect(groups[1]?.messages.map((message) => message.id)).toEqual(["m3"]);
  });

  test("間に別送信者が入ると同一送信者でも別グループになる", () => {
    const messages: Message[] = [
      createMessage({
        id: "m1",
        senderId: "alice",
        senderName: "Alice",
        body: "alice-1",
        sentAt: "2025-01-01T10:00:00.000Z",
      }),
      createMessage({
        id: "m2",
        senderId: "bob",
        senderName: "Bob",
        body: "bob-1",
        sentAt: "2025-01-01T10:02:00.000Z",
      }),
      createMessage({
        id: "m3",
        senderId: "alice",
        senderName: "Alice",
        body: "alice-2",
        sentAt: "2025-01-01T10:04:00.000Z",
      }),
    ];

    const groups = groupConsecutiveMessages(messages);

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.senderId)).toEqual(["alice", "bob", "alice"]);
  });

  test("時刻が不正な投稿はグルーピングしない", () => {
    const messages: Message[] = [
      createMessage({
        id: "m1",
        senderId: "alice",
        senderName: "Alice",
        body: "timestamp-invalid",
        sentAt: "invalid-date",
      }),
      createMessage({
        id: "m2",
        senderId: "alice",
        senderName: "Alice",
        body: "timestamp-valid",
        sentAt: "2025-01-01T10:01:00.000Z",
      }),
    ];

    const groups = groupConsecutiveMessages(messages);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.id)).toEqual(["group-m1", "group-m2"]);
  });
});
