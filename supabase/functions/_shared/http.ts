import type { ApiErrorBody } from "../../../shared/api-contracts.ts";

export function jsonResponse(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function errorResponse(
  code: ApiErrorBody["error"]["code"],
  message: string,
  status: number,
  headers: HeadersInit = {},
): Response {
  return jsonResponse({ error: { code, message } } satisfies ApiErrorBody, status, headers);
}

export function acceptsJson(request: Request): boolean {
  return request.headers.get("content-type")?.toLowerCase().startsWith("application/json") ?? false;
}
