import { parseChatRequest } from "../../../shared/api-contracts.ts";
import { verifySessionToken } from "../_shared/auth.ts";
import { getConfiguredOrigins, resolveCors } from "../_shared/cors.ts";
import { acceptsJson, errorResponse } from "../_shared/http.ts";
import { jsonResponse } from "../_shared/http.ts";
import { ALLOWED_GEMINI_MODELS, queryGeminiFileSearch, type GeminiConfig } from "../_shared/gemini.ts";

interface ChatDependencies {
  allowedOrigins: readonly string[];
  sessionSecret: string | undefined;
  now: () => number;
  geminiConfig?: GeminiConfig;
  queryGemini?: typeof queryGeminiFileSearch;
}

export async function handleFestivalChat(
  request: Request,
  dependencies: ChatDependencies = {
    allowedOrigins: getConfiguredOrigins(),
    sessionSecret: Deno.env.get("SESSION_SIGNING_SECRET"),
    now: Date.now,
    geminiConfig: readGeminiConfig(),
    queryGemini: queryGeminiFileSearch,
  },
): Promise<Response> {
  const cors = resolveCors(request, dependencies.allowedOrigins);
  if (!cors.allowed) return errorResponse("UNAUTHORIZED", "この接続元からは利用できません。", 403, cors.headers);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors.headers });
  if (request.method !== "POST") return errorResponse("INVALID_INPUT", "POSTで送信してください。", 405, cors.headers);
  if (!acceptsJson(request)) return errorResponse("INVALID_INPUT", "JSON形式で送信してください。", 415, cors.headers);

  const authorization = request.headers.get("authorization");
  if (!dependencies.sessionSecret) {
    return errorResponse("INTERNAL_ERROR", "認証設定を確認できませんでした。", 500, cors.headers);
  }
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const session = token ? await verifySessionToken(token, dependencies.sessionSecret, dependencies.now()) : null;
  if (!session) {
    return errorResponse("UNAUTHORIZED", "パスコードまたはセッションを確認してください。", 401, cors.headers);
  }

  const body: unknown = await request.json().catch(() => null);
  const chatRequest = parseChatRequest(body);
  if (!chatRequest) return errorResponse("INVALID_INPUT", "入力内容を確認してください。", 400, cors.headers);

  if (!dependencies.geminiConfig || !dependencies.queryGemini) {
    return errorResponse("UPSTREAM_ERROR", "チャット機能は現在準備中です。", 503, cors.headers);
  }
  try {
    const result = await dependencies.queryGemini(chatRequest, dependencies.geminiConfig);
    return jsonResponse(result, 200, cors.headers);
  } catch {
    return errorResponse("UPSTREAM_ERROR", "資料検索に失敗しました。時間をおいて再度お試しください。", 502, cors.headers);
  }
}

function readGeminiConfig(): GeminiConfig | undefined {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL");
  const fileSearchStore = Deno.env.get("GEMINI_FILE_SEARCH_STORE");
  const allowedModel = model && ALLOWED_GEMINI_MODELS.includes(model as (typeof ALLOWED_GEMINI_MODELS)[number]);
  return apiKey && allowedModel && fileSearchStore ? { apiKey, model, fileSearchStore } : undefined;
}

if (import.meta.main) Deno.serve((request) => handleFestivalChat(request));
