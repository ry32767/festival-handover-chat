import type { ApiErrorBody, ChatRequest, ChatResponse } from "../../shared/api-contracts.ts";

export interface AuthResult {
  session_token: string;
  expires_at: string;
}

export class ApiError extends Error {
  public constructor(public readonly code: ApiErrorBody["error"]["code"], message: string) {
    super(message);
    this.name = "ApiError";
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:54321/functions/v1").replace(/\/$/, "");

export async function authenticate(passcode: string, signal?: AbortSignal): Promise<AuthResult> {
  const response = await fetch(`${apiBaseUrl}/festival-auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode }),
    signal,
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isApiError(body)) throw new ApiError(body.error.code, body.error.message);
    throw new ApiError("INTERNAL_ERROR", "一時的なエラーが発生しました。時間をおいて再度お試しください。");
  }
  if (!isAuthResult(body)) throw new ApiError("INTERNAL_ERROR", "認証結果を確認できませんでした。");
  return body;
}

export async function sendChat(sessionToken: string, request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
  const response = await fetch(`${apiBaseUrl}/festival-chat`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isApiError(body)) throw new ApiError(body.error.code, body.error.message);
    throw new ApiError("INTERNAL_ERROR", "一時的なエラーが発生しました。時間をおいて再度お試しください。");
  }
  if (!isChatResponse(body)) throw new ApiError("INTERNAL_ERROR", "回答結果を確認できませんでした。");
  return body;
}

function isApiError(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = value.error;
  return typeof error === "object" && error !== null && "code" in error && "message" in error && typeof error.code === "string" && typeof error.message === "string";
}

function isAuthResult(value: unknown): value is AuthResult {
  return typeof value === "object" && value !== null && "session_token" in value && "expires_at" in value && typeof value.session_token === "string" && typeof value.expires_at === "string";
}

function isChatResponse(value: unknown): value is ChatResponse {
  if (typeof value !== "object" || value === null) return false;
  if (!("answer" in value) || typeof value.answer !== "string") return false;
  if (!("request_id" in value) || typeof value.request_id !== "string") return false;
  if (!("grounding" in value) || (value.grounding !== "grounded" && value.grounding !== "insufficient")) return false;
  if (!("warning" in value) || (value.warning !== null && typeof value.warning !== "string")) return false;
  if (!("sources" in value) || !Array.isArray(value.sources)) return false;
  if (!("persona" in value) || typeof value.persona !== "object" || value.persona === null) return false;
  return "id" in value.persona && typeof value.persona.id === "string"
    && "display_name" in value.persona && typeof value.persona.display_name === "string"
    && value.sources.every((source: unknown) => typeof source === "object" && source !== null
      && "source_id" in source && typeof source.source_id === "string"
      && "title" in source && typeof source.title === "string"
      && "heading" in source && typeof source.heading === "string");
}
