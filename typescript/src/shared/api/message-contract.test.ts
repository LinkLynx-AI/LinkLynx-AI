import { describe, expect, test } from "vitest";
import { MESSAGE_CREATE_RESPONSE_SCHEMA, parseMessagePayload } from "./message-contract";

describe("message-contract", () => {
  test("parseMessagePayload keeps i64 identifiers exact", () => {
    const payload = parseMessagePayload(`{
      "message": {
        "message_id": 9223372036854775002,
        "guild_id": 9223372036854775003,
        "channel_id": 9223372036854775004,
        "author_id": 9223372036854775005,
        "content": "hello contract",
        "created_at": "2026-03-10T10:01:00Z",
        "version": 1,
        "edited_at": null,
        "is_deleted": false
      }
    }`);

    const parsed = MESSAGE_CREATE_RESPONSE_SCHEMA.parse(payload);
    expect(parsed.message.message_id).toBe("9223372036854775002");
    expect(parsed.message.guild_id).toBe("9223372036854775003");
    expect(parsed.message.channel_id).toBe("9223372036854775004");
    expect(parsed.message.author_id).toBe("9223372036854775005");
  });
});
