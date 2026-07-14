const textEncoder = new TextEncoder();
const PASSCODE_ALGORITHM = "pbkdf2_sha256";
const PASSCODE_ITERATIONS = 210_000;
const SESSION_VERSION = 1;

export interface SessionClaims {
  v: 1;
  sid: string;
  iat: number;
  exp: number;
}

export async function hashPasscode(
  passcode: string,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16)),
  iterations = PASSCODE_ITERATIONS,
): Promise<string> {
  if (!passcode || iterations < 100_000) throw new Error("Invalid passcode hashing parameters");
  const digest = await derivePasscode(passcode, salt, iterations);
  return [PASSCODE_ALGORITHM, String(iterations), encodeBase64Url(salt), encodeBase64Url(digest)].join("$");
}

export async function verifyPasscode(passcode: string, encodedHash: string): Promise<boolean> {
  const parsed = parsePasscodeHash(encodedHash);
  if (!parsed) return false;
  const actual = await derivePasscode(passcode, parsed.salt, parsed.iterations);
  return timingSafeEqual(actual, parsed.digest);
}

export async function createSessionToken(
  secret: string,
  nowMs = Date.now(),
  ttlSeconds = 15 * 60,
): Promise<{ token: string; claims: SessionClaims }> {
  assertSigningSecret(secret);
  const issuedAt = Math.floor(nowMs / 1_000);
  const claims: SessionClaims = {
    v: SESSION_VERSION,
    sid: crypto.randomUUID(),
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };
  const payload = encodeBase64Url(textEncoder.encode(JSON.stringify(claims)));
  const signature = await sign(payload, secret);
  return { token: `${payload}.${encodeBase64Url(signature)}`, claims };
}

export async function verifySessionToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): Promise<SessionClaims | null> {
  try {
    assertSigningSecret(secret);
    const [payload, encodedSignature, extra] = token.split(".");
    if (!payload || !encodedSignature || extra) return null;
    const expected = await sign(payload, secret);
    const actual = decodeBase64Url(encodedSignature);
    if (!timingSafeEqual(actual, expected)) return null;
    const value: unknown = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    if (!isSessionClaims(value)) return null;
    const now = Math.floor(nowMs / 1_000);
    if (value.exp <= now || value.iat > now + 30 || value.exp - value.iat > 60 * 60) return null;
    return value;
  } catch {
    return null;
  }
}

async function derivePasscode(passcode: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(passcode), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: asArrayBuffer(salt), iterations }, key, 256);
  return new Uint8Array(bits);
}

async function sign(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload)));
}

function parsePasscodeHash(value: string): { iterations: number; salt: Uint8Array; digest: Uint8Array } | null {
  try {
    const [algorithm, rawIterations, rawSalt, rawDigest, extra] = value.split("$");
    const iterations = Number(rawIterations);
    if (algorithm !== PASSCODE_ALGORITHM || !rawSalt || !rawDigest || extra) return null;
    if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) return null;
    const salt = decodeBase64Url(rawSalt);
    const digest = decodeBase64Url(rawDigest);
    if (salt.length < 16 || digest.length !== 32) return null;
    return { iterations, salt, digest };
  } catch {
    return null;
  }
}

function isSessionClaims(value: unknown): value is SessionClaims {
  return typeof value === "object" && value !== null
    && "v" in value && value.v === SESSION_VERSION
    && "sid" in value && typeof value.sid === "string" && value.sid.length > 0
    && "iat" in value && Number.isSafeInteger(value.iat)
    && "exp" in value && Number.isSafeInteger(value.exp);
}

function assertSigningSecret(secret: string): void {
  if (textEncoder.encode(secret).length < 32) throw new Error("SESSION_SIGNING_SECRET must be at least 32 bytes");
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}
