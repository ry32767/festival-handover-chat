const LOCAL_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export interface CorsResult {
  allowed: boolean;
  headers: HeadersInit;
}

export function getConfiguredOrigins(): readonly string[] {
  const configured = Deno.env.get("ALLOWED_ORIGINS")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured?.length ? configured : LOCAL_ORIGINS;
}

export function resolveCors(request: Request, allowedOrigins: readonly string[]): CorsResult {
  const origin = request.headers.get("origin");
  const baseHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (!origin) return { allowed: true, headers: baseHeaders };
  if (!allowedOrigins.includes(origin)) return { allowed: false, headers: baseHeaders };
  return {
    allowed: true,
    headers: { ...baseHeaders, "Access-Control-Allow-Origin": origin },
  };
}
