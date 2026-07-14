import { readFile } from "node:fs/promises";
import path from "node:path";
import { queryGeminiFileSearch } from "../supabase/functions/_shared/gemini.ts";

async function main(): Promise<void> {
  await loadLocalSecrets();
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  const fileSearchStore = process.env.GEMINI_FILE_SEARCH_STORE;
  if (!apiKey || !model || !fileSearchStore) throw new Error("Geminiのローカル設定が不足しています。");

  const result = await queryGeminiFileSearch({
    message: "雨天時に文化祭運営で確認することは？",
    persona_id: "standard",
    filters: { part: "all", year: 2026 },
    conversation: [],
  }, { apiKey, model, fileSearchStore });

  console.log(`Gemini verification: grounding=${result.grounding}, answer_length=${result.answer.length}, sources=${result.sources.length}`);
  for (const source of result.sources) console.log(`source: ${source.source_id} / ${source.title} / ${source.heading}`);
  if (result.grounding !== "grounded" || result.sources.length === 0) throw new Error("File Searchの引用を確認できませんでした。");
}

async function loadLocalSecrets(): Promise<void> {
  const envPath = path.resolve("supabase", "functions", ".env.local");
  const content = await readFile(envPath, "utf8");
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u);
    if (match?.[1] && match[2] !== undefined && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
