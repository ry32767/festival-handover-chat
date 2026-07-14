import { createSessionToken, verifyPasscode } from "../_shared/auth.ts";
import { getConfiguredOrigins, resolveCors } from "../_shared/cors.ts";
import { acceptsJson, errorResponse, jsonResponse } from "../_shared/http.ts";
import { MemoryAttemptLimiter, type AttemptLimiter } from "../_shared/rate-limit.ts";

interface AuthDependencies {
  allowedOrigins: readonly string[];
  passcodeHash: string | undefined;
  sessionSecret: string | undefined;
  limiter: AttemptLimiter;
  now: () => number;
}

const defaultLimiter = new MemoryAttemptLimiter();

export async function handleFestivalAuth(
  request: Request,
  dependencies: AuthDependencies = defaultDependencies(),
): Promise<Response> {
  const cors = resolveCors(request, dependencies.allowedOrigins);
  if (!cors.allowed) return errorResponse("UNAUTHORIZED", "この接続元からは利用できません。", 403, cors.headers);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors.headers });
  if (request.method !== "POST") return errorResponse("INVALID_INPUT", "POSTで送信してください。", 405, cors.headers);
  if (!acceptsJson(request)) return errorResponse("INVALID_INPUT", "JSON形式で送信してください。", 415, cors.headers);

  const body: unknown = await request.json().catch(() => null);
  if (!isAuthRequest(body)) return errorResponse("INVALID_INPUT", "パスコードを入力してください。", 400, cors.headers);

  if (!dependencies.passcodeHash || !dependencies.sessionSecret) {
    return errorResponse("INTERNAL_ERROR", "認証設定を確認できませんでした。", 500, cors.headers);
  }

  const now = dependencies.now();
  const clientKey = getClientKey(request);
  const attempt = dependencies.limiter.status(clientKey, now);
  if (attempt.blocked) {
    return errorResponse("RATE_LIMITED", "しばらく待ってから再度お試しください。", 429, {
      ...cors.headers,
      "Retry-After": String(attempt.retryAfterSeconds),
    });
  }

  if (!await verifyPasscode(body.passcode, dependencies.passcodeHash)) {
    dependencies.limiter.recordFailure(clientKey, now);
    return errorResponse("UNAUTHORIZED", "パスコードを確認してください。", 401, cors.headers);
  }

  dependencies.limiter.reset(clientKey);
  const session = await createSessionToken(dependencies.sessionSecret, now);
  return jsonResponse({
    session_token: session.token,
    expires_at: new Date(session.claims.exp * 1_000).toISOString(),
  }, 200, cors.headers);
}

function isAuthRequest(value: unknown): value is { passcode: string } {
  return typeof value === "object" && value !== null && "passcode" in value && typeof value.passcode === "string" && value.passcode.trim().length > 0 && value.passcode.length <= 256;
}

function defaultDependencies(): AuthDependencies {
  return {
    allowedOrigins: getConfiguredOrigins(),
    passcodeHash: Deno.env.get("PASSCODE_HASH"),
    sessionSecret: Deno.env.get("SESSION_SIGNING_SECRET"),
    limiter: defaultLimiter,
    now: Date.now,
  };
}

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded
    || request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || "unknown-client";
}

if (import.meta.main) Deno.serve((request) => handleFestivalAuth(request));
