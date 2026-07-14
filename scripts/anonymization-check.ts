import { stat } from "node:fs/promises";
import path from "node:path";
import { listFiles, readUtf8 } from "./file-utils.ts";
import { scanSensitiveContent } from "./sensitive-patterns.ts";

async function main(): Promise<void> {
  const roots = [path.resolve("knowledge", "30_sources"), path.resolve("knowledge", "40_compilations")];
  const files: string[] = [];
  for (const root of roots) {
    const rootStat = await stat(root).catch(() => null);
    if (rootStat?.isDirectory()) files.push(...await listFiles(root, (filePath) => filePath.endsWith(".md")));
  }
  const findings: string[] = [];
  for (const filePath of files) {
    for (const finding of scanSensitiveContent(await readUtf8(filePath))) {
      findings.push(`${filePath}:${finding.line}: ${finding.label}の可能性`);
    }
  }
  if (findings.length) throw new Error(findings.join("\n"));
  console.log(`anonymization pattern check passed: ${files.length} files`);
  console.log("Human anonymization review is still required before synchronization.");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
