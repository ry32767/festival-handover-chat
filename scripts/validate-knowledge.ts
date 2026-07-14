import { stat } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { listFiles, readUtf8 } from "./file-utils.ts";

const knowledgeRoot = path.resolve("knowledge");
const searchableRoots = [path.join(knowledgeRoot, "30_sources"), path.join(knowledgeRoot, "40_compilations")];
const required = ["source_id", "title", "part", "document_type", "year_from", "year_to", "status", "reliability", "anonymized", "original_path"];

async function main(): Promise<void> {
  const files: string[] = [];
  for (const root of searchableRoots) {
    const rootStat = await stat(root).catch(() => null);
    if (rootStat?.isDirectory()) files.push(...await listFiles(root, (filePath) => filePath.endsWith(".md")));
  }
  if (files.length === 0) throw new Error("knowledge/30_sources または knowledge/40_compilations に検証対象Markdownがありません。");

  const ids = new Map<string, string>();
  const errors: string[] = [];
  for (const filePath of files) {
    const content = await readUtf8(filePath);
    const frontMatter = parseFrontMatter(content, filePath, errors);
    if (!frontMatter) continue;
    for (const key of required) if (!(key in frontMatter)) errors.push(`${filePath}: front matterに${key}がありません`);
    const sourceId = frontMatter.source_id;
    if (typeof sourceId === "string") {
      const existing = ids.get(sourceId);
      if (existing) errors.push(`${filePath}: source_id ${sourceId} は ${existing} と重複しています`);
      else ids.set(sourceId, filePath);
    }
    if (frontMatter.anonymized !== true) errors.push(`${filePath}: anonymized: true ではありません`);
    if (!/^#\s/m.test(content)) errors.push(`${filePath}: レベル1見出しがありません`);
  }

  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`knowledge validation passed: ${files.length} files, ${ids.size} source IDs`);
}

function parseFrontMatter(content: string, filePath: string, errors: string[]): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match?.[1]) {
    errors.push(`${filePath}: YAML front matterがありません`);
    return null;
  }
  try {
    const value: unknown = parse(match[1]);
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("mappingではありません");
    return value as Record<string, unknown>;
  } catch (error) {
    errors.push(`${filePath}: front matterを解析できません (${error instanceof Error ? error.message : "unknown"})`);
    return null;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
