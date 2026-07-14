import { queryGeminiFileSearch } from "./gemini.ts";

Deno.test("Gemini File Search response maps citations without exposing raw metadata", async () => {
  const response = await queryGeminiFileSearch({
    message: "雨天時は？",
    persona_id: "concise",
    filters: { part: "all", year: 2026 },
    conversation: [],
  }, {
    apiKey: "test-key",
    model: "gemini-3.1-flash-lite",
    fileSearchStore: "fileSearchStores/test",
  }, {
    fetch: () => Promise.resolve(Response.json({
      id: "interaction-1",
      steps: [{
        type: "model_output",
        content: [{
          type: "text",
          text: "雨天手順を確認してください。",
          annotations: [{
            type: "file_citation",
            file_name: "02_schedule.md",
            source: "## 雨天対応\n手順を確認する。",
            custom_metadata: { source_id: "COMP-DETAIL-002", title: "合同会議・全体スケジュール" },
          }],
        }],
      }],
    })) as Promise<Response>,
  });

  assertEquals(response.grounding, "grounded");
  assertEquals(response.persona.display_name, "gemini");
  assertEquals(response.sources[0]?.heading, "雨天対応");
  assertEquals(response.sources[0]?.source_id, "COMP-DETAIL-002");
});

Deno.test("Gemini File Search response marks answers without citations as insufficient", async () => {
  const response = await queryGeminiFileSearch({
    message: "資料にない質問",
    persona_id: "standard",
    filters: { part: "all", year: "all" },
    conversation: [],
  }, {
    apiKey: "test-key",
    model: "gemini-3.1-flash-lite",
    fileSearchStore: "fileSearchStores/test",
  }, {
    fetch: () => Promise.resolve(Response.json({
      steps: [{ type: "model_output", content: [{ type: "text", text: "確認できません。" }] }],
    })) as Promise<Response>,
  });

  assertEquals(response.grounding, "insufficient");
  assertEquals(response.sources.length, 0);
  assertEquals(typeof response.warning, "string");
});

Deno.test("Gemini prompt includes selected character instructions", async () => {
  let prompt = "";
  await queryGeminiFileSearch({
    message: "議論調で確認して",
    persona_id: "senior_supporter",
    filters: { part: "all", year: "all" },
    conversation: [],
  }, {
    apiKey: "test-key",
    model: "gemini-3.1-flash-lite",
    fileSearchStore: "fileSearchStores/test",
  }, {
    fetch: (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { input?: unknown };
      prompt = typeof body.input === "string" ? body.input : "";
      return Promise.resolve(Response.json({
        steps: [{ type: "model_output", content: [{ type: "text", text: "すだゆうです。論点を整理します。" }] }],
      })) as Promise<Response>;
    },
  });

  assertIncludes(prompt, "回答キャラクター: すだゆう");
  assertIncludes(prompt, "冒頭は必ず「すだゆうです。」");
  assertIncludes(prompt, "議論で答えている感じ");
  assertIncludes(prompt, "共通ポリシー、出典規則、安全判断");
});

function assertEquals(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

function assertIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) throw new Error(`Expected prompt to include: ${expected}`);
}
