import { pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const iterations = 210_000;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

async function main(): Promise<void> {
  const passcode = createPasscode(20);
  const salt = randomBytes(16);
  const digest = pbkdf2Sync(passcode, salt, iterations, 32, "sha256");
  const passcodeHash = ["pbkdf2_sha256", String(iterations), salt.toString("base64url"), digest.toString("base64url")].join("$");
  const sessionSecret = randomBytes(48).toString("base64url");
  const target = path.resolve("supabase", "functions", ".env.local");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, [
    "ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    `PASSCODE_HASH=${passcodeHash}`,
    `SESSION_SIGNING_SECRET=${sessionSecret}`,
    "",
  ].join("\n"), { encoding: "utf8", mode: 0o600, flag: "wx" });

  console.log("Local auth secrets were written to supabase/functions/.env.local");
  console.log(`Trial passcode (shown once): ${passcode}`);
  console.log("Keep the passcode out of Git, chat, screenshots, and shared logs.");
}

function createPasscode(length: number): string {
  const bytes = randomBytes(length);
  let result = "";
  for (const byte of bytes) result += alphabet[byte % alphabet.length];
  return result;
}

void main().catch((error: unknown) => {
  if (error instanceof Error && "code" in error && error.code === "EEXIST") {
    console.error("supabase/functions/.env.local already exists. Remove it intentionally before rotating local credentials.");
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
