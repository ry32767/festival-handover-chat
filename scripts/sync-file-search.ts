import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { listFiles, readUtf8 } from "./file-utils.ts";

interface SearchDocument {
  filePath: string;
  relativePath: string;
  content: string;
  sourceId: string;
  title: string;
  part: string;
  sha256: string;
}

interface Operation {
  name?: string;
  done?: boolean;
  error?: { message?: string };
}

const apiBase = "https://generativelanguage.googleapis.com/v1beta";
const uploadBase = "https://generativelanguage.googleapis.com/upload/v1beta";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const execute = process.argv.includes("--execute");
  if (dryRun === execute) throw new Error("--dry-run または --execute のどちらか一方を指定してください。");

  const documents = await collectDocuments();
  if (documents.length === 0) throw new Error("同期対象Markdownがありません。");
  if (dryRun) {
    console.log("DRY RUN: Gemini File Search Storeは変更しません。");
    console.log(`候補Markdown: ${documents.length}件`);
    for (const document of documents) console.log(document.relativePath);
    return;
  }

  await loadLocalSecrets();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEYが設定されていません。");

  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const store = await createStore(apiKey, `festival-handover-${timestamp}`);
  console.log(`新しいFile Search Storeを作成しました: ${store.name}`);
  for (const [index, document] of documents.entries()) {
    console.log(`投入中 ${index + 1}/${documents.length}: ${document.relativePath}`);
    const operation = await uploadDocument(apiKey, store.name, document);
    await waitForOperation(apiKey, operation);
  }

  const manifest = {
    synced_at: new Date().toISOString(),
    store_name: store.name,
    file_count: documents.length,
    files: documents.map((document) => ({
      path: document.relativePath,
      source_id: document.sourceId,
      sha256: document.sha256,
    })),
  };
  const manifestPath = path.resolve("knowledge", "90_indexes", "file_search_sync_manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`同期完了: ${documents.length}件`);
  console.log(`次にGEMINI_FILE_SEARCH_STOREへ設定する値: ${store.name}`);
}

async function collectDocuments(): Promise<SearchDocument[]> {
  const roots = ["00_core", "10_domains", "20_topics", "30_sources", "40_compilations"].map((directory) => path.resolve("knowledge", directory));
  const files: string[] = [];
  for (const root of roots) files.push(...await listFiles(root, (filePath) => filePath.endsWith(".md")).catch(() => []));
  const documents: SearchDocument[] = [];
  for (const filePath of files) {
    const content = await readUtf8(filePath);
    const metadata = parseFrontMatter(content, filePath);
    documents.push({
      filePath,
      relativePath: path.relative(process.cwd(), filePath),
      content,
      sourceId: requiredString(metadata, "source_id", filePath),
      title: requiredString(metadata, "title", filePath),
      part: requiredString(metadata, "part", filePath),
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  return documents;
}

async function loadLocalSecrets(): Promise<void> {
  if (process.env.GEMINI_API_KEY) return;
  const envPath = path.resolve("supabase", "functions", ".env.local");
  const content = await readFile(envPath, "utf8").catch(() => "");
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u);
    if (match?.[1] && match[2] !== undefined && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

async function createStore(apiKey: string, displayName: string): Promise<{ name: string }> {
  const response = await geminiFetch(`${apiBase}/fileSearchStores`, apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName, embeddingModel: "models/gemini-embedding-2" }),
  });
  const value: unknown = await response.json();
  if (!isRecord(value) || typeof value.name !== "string") throw new Error("File Search Store作成結果を確認できませんでした。");
  return { name: value.name };
}

async function uploadDocument(apiKey: string, storeName: string, document: SearchDocument): Promise<Operation> {
  const bytes = new TextEncoder().encode(document.content);
  const start = await geminiFetch(`${uploadBase}/${storeName}:uploadToFileSearchStore`, apiKey, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": "text/plain; charset=utf-8",
    },
    body: JSON.stringify({
      displayName: path.basename(document.filePath),
      customMetadata: [
        { key: "source_id", stringValue: document.sourceId },
        { key: "title", stringValue: document.title },
        { key: "part", stringValue: document.part },
        { key: "path", stringValue: document.relativePath },
      ],
    }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error(`アップロードURLを取得できませんでした: ${document.relativePath}`);
  const finish = await geminiFetch(uploadUrl, apiKey, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "Content-Type": "text/plain; charset=utf-8",
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  const value: unknown = await finish.json();
  if (!isRecord(value)) throw new Error(`アップロード結果を確認できませんでした: ${document.relativePath}`);
  return value as Operation;
}

async function waitForOperation(apiKey: string, initial: Operation): Promise<void> {
  let operation = initial;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (operation.error) throw new Error("File Searchの取り込み処理が失敗しました。");
    if (operation.done) return;
    if (!operation.name) throw new Error("File Search operation名を確認できませんでした。");
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const response = await geminiFetch(`${apiBase}/${operation.name}`, apiKey);
    const value: unknown = await response.json();
    if (!isRecord(value)) throw new Error("File Search operation結果を確認できませんでした。");
    operation = value as Operation;
  }
  throw new Error("File Searchの取り込み完了待機がタイムアウトしました。");
}

async function geminiFetch(url: string, apiKey: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-goog-api-key", apiKey);
  const response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Gemini API request failed (${response.status})`);
  return response;
}

function parseFrontMatter(content: string, filePath: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/u);
  if (!match?.[1]) throw new Error(`${filePath}: YAML front matterがありません`);
  const value: unknown = parse(match[1]);
  if (!isRecord(value)) throw new Error(`${filePath}: front matterがmappingではありません`);
  if (value.anonymized !== true) throw new Error(`${filePath}: anonymized: trueではありません`);
  return value;
}

function requiredString(value: Record<string, unknown>, key: string, filePath: string): string {
  const result = value[key];
  if (typeof result !== "string" || !result) throw new Error(`${filePath}: ${key}がありません`);
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
