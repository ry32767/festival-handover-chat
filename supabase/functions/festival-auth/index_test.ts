import { hashPasscode, verifySessionToken } from "../_shared/auth.ts";
import { MemoryAttemptLimiter } from "../_shared/rate-limit.ts";
import { handleFestivalAuth } from "./index.ts";

const allowedOrigins = ["http://localhost:5173"];
const sessionSecret = "test-session-secret-that-is-at-least-32-bytes";
const now = Date.UTC(2026, 6, 13, 12, 0, 0);
const passcode = "correct horse battery staple";
const passcodeHash = await hashPasscode(passcode, new Uint8Array(16).fill(7), 100_000);

Deno.test("festival-auth issues a verifiable short-lived session", async () => {
  const response = await handleFestivalAuth(authRequest(passcode), dependencies());
  assertEquals(response.status, 200);
  const body = await response.json();
  const claims = await verifySessionToken(body.session_token, sessionSecret, now);
  assert(claims !== null, "session should verify");
  assertEquals(body.expires_at, new Date((claims?.exp ?? 0) * 1_000).toISOString());
});

Deno.test("festival-auth rejects an incorrect passcode", async () => {
  const response = await handleFestivalAuth(authRequest("incorrect"), dependencies());
  assertEquals(response.status, 401);
});

Deno.test("festival-auth blocks the sixth failed attempt in fifteen minutes", async () => {
  const limiter = new MemoryAttemptLimiter();
  const deps = dependencies(limiter);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await handleFestivalAuth(authRequest("incorrect"), deps);
    assertEquals(response.status, 401);
  }
  const blocked = await handleFestivalAuth(authRequest(passcode), deps);
  assertEquals(blocked.status, 429);
  assertEquals(blocked.headers.get("Retry-After"), "900");
});

Deno.test("festival-auth does not expose missing secret details", async () => {
  const response = await handleFestivalAuth(authRequest(passcode), {
    ...dependencies(),
    passcodeHash: undefined,
  });
  assertEquals(response.status, 500);
  const body = await response.text();
  assert(!body.includes(sessionSecret), "response must not expose secrets");
});

function dependencies(limiter = new MemoryAttemptLimiter()) {
  return { allowedOrigins, passcodeHash, sessionSecret, limiter, now: () => now };
}

function authRequest(value: string): Request {
  return new Request("http://localhost/functions/v1/festival-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.1" },
    body: JSON.stringify({ passcode: value }),
  });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}
