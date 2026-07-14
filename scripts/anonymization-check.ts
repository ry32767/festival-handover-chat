import { stat } from "node:fs/promises";
import path from "node:path";
import { listFiles, readUtf8 } from "./file-utils.ts";

const patterns = [
  { label: "email", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu },
  { label: "phone", pattern: /(?:0\d{1,4}[-ー\s]\d{1,4}[-ー\s]\d{3,4}|0\d{9,10})/gu },
  { label: "LINE identifier", pattern: /LINE\s*(?:ID|アカウント)?\s*[:：]\s*@?[A-Z0-9._-]+/giu },
  { label: "credential", pattern: /(?:パスワード|password|passcode|secret)\s*(?:[:：=]|は)\s*`?[^`、。\s]+`?/giu },
];

async function main(): Promise<void> {
  const roots = [path.resolve("knowledge", "30_sources"), path.resolve("knowledge", "40_compilations")];
  const files: string[] = [];
  for (const root of roots) {
    const rootStat = await stat(root).catch(() => null);
    if (rootStat?.isDirectory()) files.push(...await listFiles(root, (filePath) => filePath.endsWith(".md")));
  }
  const findings: string[] = [];
  for (const filePath of files) {
    const lines = (await readUtf8(filePath)).split(/\r?\n/u);
    lines.forEach((line, index) => {
      for (const { label, pattern } of patterns) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) findings.push(`${filePath}:${index + 1}: ${label}の可能性`);
      }
    });
  }
  if (findings.length) throw new Error(findings.join("\n"));
  console.log(`anonymization pattern check passed: ${files.length} files`);
  console.log("Human anonymization review is still required before synchronization.");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
