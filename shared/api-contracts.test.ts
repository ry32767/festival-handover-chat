import { describe, expect, it } from "vitest";
import { parseChatRequest } from "./api-contracts.ts";

describe("parseChatRequest", () => {
  it("accepts a request defined by the API contract", () => {
    const result = parseChatRequest({
      message: "4月に確認することは？",
      persona_id: "standard",
      filters: { part: "classroom_booths", year: 2026 },
      conversation: [],
    });
    expect(result?.message).toBe("4月に確認することは？");
  });

  it("rejects untrusted filter and persona values", () => {
    expect(parseChatRequest({
      message: "確認事項",
      persona_id: "arbitrary-prompt",
      filters: { part: "../../secret", year: 2026 },
      conversation: [],
    })).toBeNull();
  });

  it("rejects questions over 2,000 characters", () => {
    expect(parseChatRequest({
      message: "あ".repeat(2_001),
      persona_id: "standard",
      filters: { part: "all", year: "all" },
      conversation: [],
    })).toBeNull();
  });
});
