import { access } from "node:fs/promises";
import path from "node:path";
import { listFiles, readUtf8 } from "./file-utils.ts";

const roots = ["src", "shared", "scripts", "supabase", ".github"];
const standalone = ["package.json", "vite.config.ts", "playwright.config.ts", "vitest.config.ts"];
const patterns = [
  { label: "Google API key", pattern: /AIza[0-9A-Za-z_-]{30,}/gu },
  { label: "JWT-like secret", pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu },
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu },
];

async function main(): Promise<void> {
  const files: string[] = [];
  for (const root of roots) {
    if (await exists(root)) files.push(...await listFiles(root, isTextImplementationFile));
  }
  for (const filePath of standalone) if (await exists(filePath)) files.push(filePath);

  const findings: string[] = [];
  for (const filePath of files) {
    const content = await readUtf8(filePath);
    for (const { label, pattern } of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) findings.push(`${filePath}: ${label}`);
    }
  }
  if (findings.length) throw new Error(findings.join("\n"));
  console.log(`implementation secret scan passed: ${files.length} files`);
}

function isTextImplementationFile(filePath: string): boolean {
  return /\.(?:ts|tsx|js|json|toml|ya?ml|css|html|md)$/u.test(filePath) && !filePath.endsWith(".env");
}

async function exists(filePath: string): Promise<boolean> {
  return access(path.resolve(filePath)).then(() => true, () => false);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
