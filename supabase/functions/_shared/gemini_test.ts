import { ALLOWED_GEMINI_MODELS, queryGeminiFileSearch } from "./gemini.ts";

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
  // 元ソース閲覧: File Searchの根拠チャンク本文を追加コールなしで抜粋として同梱する。
  assertEquals(response.sources[0]?.excerpt, "## 雨天対応\n手順を確認する。");
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

Deno.test("Gemini response falls back to selected part source when citations are missing", async () => {
  const response = await queryGeminiFileSearch({
    message: "配置移動の前日準備で確認することは？",
    persona_id: "concise",
    filters: { part: "layout_and_movement", year: 2026 },
    conversation: [],
  }, {
    apiKey: "test-key",
    model: "gemini-3.1-flash-lite",
    fileSearchStore: "fileSearchStores/test",
  }, {
    fetch: () => Promise.resolve(Response.json({
      steps: [{ type: "model_output", content: [{ type: "text", text: "geminiです。配置移動の前日準備では、備品移動とシール貼付を確認します。" }] }],
    })) as Promise<Response>,
  });

  assertEquals(response.grounding, "grounded");
  assertEquals(response.sources[0]?.source_id, "COMP-DETAIL-007");
  assertEquals(response.warning, null);
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
  assertIncludes(prompt, "淡々と、はっきりした話し言葉");
  assertIncludes(prompt, "会社の会議で発言できる程度");
  assertIncludes(prompt, "基本は丁寧語");
  assertIncludes(prompt, "通常の意見、感想、状況整理、軽い問いかけ");
  assertIncludes(prompt, "落ち着いた丁寧語");
  assertIncludes(prompt, "相手への依頼や指示、重大な注意");
  assertIncludes(prompt, "より明確な丁寧語へ切り替える");
  assertIncludes(prompt, "ため口");
  assertIncludes(prompt, "Markdownの見出し、太字見出し、箇条書き、番号リストは多用しない");
  assertIncludes(prompt, "段落だけでは読みにくい場合だけ短い箇条書き");
  assertIncludes(prompt, "各項目を必ず改行");
  assertIncludes(prompt, "1文の中へ中黒を詰め込まない");
  assertIncludes(prompt, "資料の根拠、数字、ルール、確認先は省略しない");
  assertIncludes(prompt, "根拠説明だけの硬いパートとキャラ口調だけのパートを分けない");
  assertIncludes(prompt, "資料上の事実→懸念→確認先→すだゆうらしい反応を一続きの話し言葉として統合する");
  assertIncludes(prompt, "場面に応じて口癖や言い回しを自然に入れる");
  assertIncludes(prompt, "〜か、、");
  assertIncludes(prompt, "〜でして、、");
  assertIncludes(prompt, "体言止めをやや多めに使い");
  assertIncludes(prompt, "軽いツッコミや笑い混じりでは「あのさぁ（笑）」");
  assertIncludes(prompt, "語尾伸ばし");
  assertIncludes(prompt, "〜ですねぇ");
  assertIncludes(prompt, "ストレス交じりの指示や強めの要請ほど丁寧語");
  assertIncludes(prompt, "冒頭は必ず「すだゆうです。」");
  assertIncludes(prompt, "会話に割って入って一言指摘するときや軽い前置きは「あの、」");
  assertIncludes(prompt, "「あのですね」は乱発せず");
  assertIncludes(prompt, "理不尽な要求や到底実現不可能なこと");
  assertIncludes(prompt, "少し怒りを込めて反論するときだけに限定");
  assertIncludes(prompt, "穏やかな反対には「あのですね」を使わず");
  assertIncludes(prompt, "論理的で、批判的思考にもとづき論点を検討する姿勢");
  assertIncludes(prompt, "共通ポリシー、出典規則、安全判断");
});

Deno.test("Gemini prompt includes senior_supporter tone examples as few-shot guidance", async () => {
  let prompt = "";
  await queryGeminiFileSearch({
    message: "受付を減らしたい",
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
        steps: [{ type: "model_output", content: [{ type: "text", text: "すだゆうです。" }] }],
      })) as Promise<Response>;
    },
  });

  assertIncludes(prompt, "すだゆうの口調サンプル");
  assertIncludes(prompt, "資料の代わりに事実として使わない");
  assertIncludes(prompt, "受付の人数減らすか、、");
  assertIncludes(prompt, "これが今日判明しまして、、");
  assertIncludes(prompt, "あの、その前に一点だけ");
  assertIncludes(prompt, "利用者:");
});

Deno.test("Gemini prompt omits example block for personas without examples", async () => {
  let prompt = "";
  await queryGeminiFileSearch({
    message: "雨天時は？",
    persona_id: "concise",
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
        steps: [{ type: "model_output", content: [{ type: "text", text: "geminiです。" }] }],
      })) as Promise<Response>;
    },
  });

  if (prompt.includes("口調サンプル")) throw new Error("concise prompt should not include tone examples");
});

Deno.test("Gemini prompt keeps structured lists restrained for character personas", async () => {
  const prompts = new Map<string, string>();
  for (const personaId of ["standard", "concise", "senior_supporter"] as const) {
    await queryGeminiFileSearch({
      message: "模擬店を増やす場合の懸念は？",
      persona_id: personaId,
      filters: { part: "classroom_booths", year: 2026 },
      conversation: [],
    }, {
      apiKey: "test-key",
      model: "gemini-3.1-flash-lite",
      fileSearchStore: "fileSearchStores/test",
    }, {
      fetch: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { input?: unknown };
        prompts.set(personaId, typeof body.input === "string" ? body.input : "");
        return Promise.resolve(Response.json({
          steps: [{ type: "model_output", content: [{ type: "text", text: "回答です。" }] }],
        })) as Promise<Response>;
      },
    });
  }

  assertIncludes(prompts.get("standard") ?? "", "箇条書き、番号リストは多用しない");
  assertIncludes(prompts.get("standard") ?? "", "短い会話文の段落");
  assertIncludes(prompts.get("standard") ?? "", "確認事項や手順が3件以上ある場合だけ");
  assertIncludes(prompts.get("standard") ?? "", "1文の中へ中黒を詰め込まない");
  assertIncludes(prompts.get("concise") ?? "", "Markdownの短い見出し、太字、最大5項目程度の箇条書き");
  assertIncludes(prompts.get("senior_supporter") ?? "", "箇条書き、番号リストは多用しない");
  assertIncludes(prompts.get("senior_supporter") ?? "", "段落だけでは読みにくい場合だけ短い箇条書き");
  assertIncludes(prompts.get("senior_supporter") ?? "", "説明文や報告書のように並べない");
});

Deno.test("Gemini prompt includes selected part and year retrieval hints", async () => {
  let prompt = "";
  await queryGeminiFileSearch({
    message: "前日準備で確認することは？",
    persona_id: "concise",
    filters: { part: "layout_and_movement", year: 2026 },
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
        steps: [{ type: "model_output", content: [{ type: "text", text: "geminiです。配置移動の資料を確認します。" }] }],
      })) as Promise<Response>;
    },
  });

  assertIncludes(prompt, "対象パート: 配置移動 (layout_and_movement)");
  assertIncludes(prompt, "配置移動・会計");
  assertIncludes(prompt, "07_layout_and_accounting.md");
  assertIncludes(prompt, "year_from/year_toの範囲に2026を含む資料");
});

Deno.test("Gemini retries when a grounded answer arrives without citations (flaky annotations)", async () => {
  let calls = 0;
  const response = await queryGeminiFileSearch({
    message: "教室模擬の準備金は年度でどう変わった？",
    persona_id: "concise",
    filters: { part: "classroom_booths", year: "all" },
    conversation: [],
  }, {
    apiKey: "test-key",
    model: "gemini-3.1-flash-lite",
    fileSearchStore: "fileSearchStores/test",
  }, {
    fetch: () => {
      calls += 1;
      // 1回目は File Search は走ったのに注釈欠落、2回目で file_citation が付く。
      if (calls === 1) {
        return Promise.resolve(Response.json({
          steps: [
            { type: "file_search_call" },
            { type: "file_search_result", signature: "opaque" },
            { type: "model_output", content: [{ type: "text", text: "geminiです。準備金は年度で変わっています。" }] },
          ],
        })) as Promise<Response>;
      }
      return Promise.resolve(Response.json({
        steps: [
          { type: "file_search_call" },
          { type: "file_search_result", signature: "opaque" },
          {
            type: "model_output",
            content: [{
              type: "text",
              text: "geminiです。準備金は5万円から段階的に変わっています。",
              annotations: [{
                type: "file_citation",
                file_name: "classroom_booths_archive_2019_2025.md",
                source: "## 5.8 準備金の推移\n5万円→45,000円→35,000円。",
                custom_metadata: { source_id: "SRC-CLASSROOM-ARCHIVE-001", title: "教室模擬パート 歴代アーカイブ（2019-2025）" },
              }],
            }],
          },
        ],
      })) as Promise<Response>;
    },
  });

  assertEquals(calls, 2);
  assertEquals(response.grounding, "grounded");
  assertEquals(response.sources[0]?.source_id, "SRC-CLASSROOM-ARCHIVE-001");
  assertEquals(response.sources[0]?.excerpt, "## 5.8 準備金の推移\n5万円→45,000円→35,000円。");
});

Deno.test("Gemini does not retry when File Search never ran (off-topic question)", async () => {
  let calls = 0;
  const response = await queryGeminiFileSearch({
    message: "明日の天気は？",
    persona_id: "concise",
    filters: { part: "all", year: "all" },
    conversation: [],
  }, {
    apiKey: "test-key",
    model: "gemini-3.1-flash-lite",
    fileSearchStore: "fileSearchStores/test",
  }, {
    fetch: () => {
      calls += 1;
      // file_search ステップなし＝検索が走っていない。再試行しても無駄なので1回で確定。
      return Promise.resolve(Response.json({
        steps: [{ type: "model_output", content: [{ type: "text", text: "確認できませんでした。" }] }],
      })) as Promise<Response>;
    },
  });

  assertEquals(calls, 1);
  assertEquals(response.grounding, "insufficient");
});

Deno.test("Gemini retries up to the max when File Search ran but citations never appear", async () => {
  let calls = 0;
  const response = await queryGeminiFileSearch({
    message: "教室模擬の準備金は？",
    persona_id: "concise",
    filters: { part: "classroom_booths", year: "all" },
    conversation: [],
  }, {
    apiKey: "test-key",
    model: "gemini-3.1-flash-lite",
    fileSearchStore: "fileSearchStores/test",
  }, {
    fetch: () => {
      calls += 1;
      // File Searchは毎回走るが注釈が付かない（最悪ケース）。最大回数まで再試行し、最後はフォールバック出典。
      return Promise.resolve(Response.json({
        steps: [
          { type: "file_search_call" },
          { type: "file_search_result", signature: "opaque" },
          { type: "model_output", content: [{ type: "text", text: "geminiです。準備金は年度で変わります。" }] },
        ],
      })) as Promise<Response>;
    },
  });

  assertEquals(calls, 3);
  assertEquals(response.sources[0]?.source_id, "COMP-DETAIL-003");
});

Deno.test("Gemini prompt injects a knowledge map so a weak model does not deny a whole part", async () => {
  let prompt = "";
  await queryGeminiFileSearch({
    message: "教室模擬の準備で確認することは？",
    persona_id: "concise",
    filters: { part: "classroom_booths", year: "all" },
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
        steps: [{ type: "model_output", content: [{ type: "text", text: "geminiです。" }] }],
      })) as Promise<Response>;
    },
  });

  assertIncludes(prompt, "「教室模擬パート（03_classroom_booths.md）」が必ず存在します");
  assertIncludes(prompt, "「存在しない」と断定しないでください");
  assertIncludes(prompt, "一括で「見当たらない」とは書かないでください");
  assertIncludes(prompt, "検索補助キーワード");
  assertIncludes(prompt, "模擬店");
});

Deno.test("Gemini prompt asks for year-labeled concrete examples without fabricating data", async () => {
  let prompt = "";
  await queryGeminiFileSearch({
    message: "過去の準備金は？",
    persona_id: "concise",
    filters: { part: "classroom_booths", year: "all" },
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
        steps: [{ type: "model_output", content: [{ type: "text", text: "geminiです。" }] }],
      })) as Promise<Response>;
    },
  });

  assertIncludes(prompt, "年度名または世代名を添えた具体例を優先");
  assertIncludes(prompt, "資料にない年度・数値・事例は創作しない");
});

Deno.test("Gemini falls back to overall-operations source for current_festival_records without citations", async () => {
  const response = await queryGeminiFileSearch({
    message: "今年度の全体の流れは？",
    persona_id: "concise",
    filters: { part: "current_festival_records", year: 2026 },
    conversation: [],
  }, {
    apiKey: "test-key",
    model: "gemini-3.1-flash-lite",
    fileSearchStore: "fileSearchStores/test",
  }, {
    fetch: () => Promise.resolve(Response.json({
      steps: [{ type: "model_output", content: [{ type: "text", text: "geminiです。今年度の全体運営を確認します。" }] }],
    })) as Promise<Response>,
  });

  assertEquals(response.grounding, "grounded");
  assertEquals(response.sources[0]?.source_id, "COMP-DETAIL-001");
});

Deno.test("Gemini models are limited to the approved choices", () => {
  assertEquals(ALLOWED_GEMINI_MODELS.includes("gemini-2.5-flash"), true);
  assertEquals(ALLOWED_GEMINI_MODELS.includes("gemini-3.1-flash-lite"), true);
  assertEquals((ALLOWED_GEMINI_MODELS as readonly string[]).includes("gemini-1.5-flash"), false);
});

function assertEquals(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

function assertIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) throw new Error(`Expected prompt to include: ${expected}`);
}
