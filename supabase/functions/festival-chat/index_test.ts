import { createSessionToken } from "../_shared/auth.ts";
import { handleFestivalChat } from "./index.ts";

const allowedOrigins = ["http://localhost:5173"];
const sessionSecret = "test-session-secret-that-is-at-least-32-bytes";
const now = Date.UTC(2026, 6, 13, 12, 0, 0);

Deno.test("festival-chat rejects requests without a session", async () => {
  const response = await handleFestivalChat(new Request("http://localhost/functions/v1/festival-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validBody()),
  }), dependencies());
  assertEquals(response.status, 401);
});

Deno.test("festival-chat rejects untrusted filters", async () => {
  const token = (await createSessionToken(sessionSecret, now)).token;
  const response = await handleFestivalChat(new Request("http://localhost/functions/v1/festival-chat", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...validBody(), filters: { part: "../../secret", year: 2026 } }),
  }), dependencies());
  assertEquals(response.status, 400);
});

Deno.test("festival-chat returns a safe placeholder after validation", async () => {
  const token = (await createSessionToken(sessionSecret, now)).token;
  const response = await handleFestivalChat(new Request("http://localhost/functions/v1/festival-chat", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(validBody()),
  }), dependencies());
  assertEquals(response.status, 503);
  const body = await response.json();
  assertEquals(body.error.code, "UPSTREAM_ERROR");
});

Deno.test("festival-chat returns a grounded Gemini response", async () => {
  const token = (await createSessionToken(sessionSecret, now)).token;
  const response = await handleFestivalChat(new Request("http://localhost/functions/v1/festival-chat", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(validBody()),
  }), {
    ...dependencies(),
    geminiConfig: { apiKey: "test-key", model: "test-model", fileSearchStore: "fileSearchStores/test" },
    queryGemini: () => Promise.resolve({
      answer: "4月は企画書と必要物品を確認します。",
      persona: { id: "standard", display_name: "あすとら" },
      sources: [{ source_id: "COMP-DETAIL-003", title: "教室模擬パート", heading: "4月" }],
      grounding: "grounded",
      warning: null,
      request_id: "test-request",
    }),
  });
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.sources[0].source_id, "COMP-DETAIL-003");
});

Deno.test("festival-chat hides Gemini failures", async () => {
  const token = (await createSessionToken(sessionSecret, now)).token;
  const response = await handleFestivalChat(new Request("http://localhost/functions/v1/festival-chat", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(validBody()),
  }), {
    ...dependencies(),
    geminiConfig: { apiKey: "test-key", model: "test-model", fileSearchStore: "fileSearchStores/test" },
    queryGemini: () => Promise.reject(new Error("upstream body with secret")),
  });
  assertEquals(response.status, 502);
  const body = await response.json();
  assertEquals(body.error.code, "UPSTREAM_ERROR");
  assertEquals(JSON.stringify(body).includes("secret"), false);
});

Deno.test("festival-chat rejects a tampered session", async () => {
  const token = (await createSessionToken(sessionSecret, now)).token;
  const response = await handleFestivalChat(new Request("http://localhost/functions/v1/festival-chat", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}x`, "Content-Type": "application/json" },
    body: JSON.stringify(validBody()),
  }), dependencies());
  assertEquals(response.status, 401);
});

function dependencies() {
  return { allowedOrigins, sessionSecret, now: () => now };
}

function validBody(): Record<string, unknown> {
  return {
    message: "4月に確認することは？",
    persona_id: "standard",
    filters: { part: "classroom_booths", year: 2026 },
    conversation: [],
  };
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}
