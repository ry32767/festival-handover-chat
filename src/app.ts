import {
  PART_IDS,
  PERSONA_IDS,
  YEAR_IDS,
  type ChatResponse,
  type ConversationMessage,
  type PartId,
  type PersonaId,
  type YearId,
} from "../shared/api-contracts.ts";
import { ApiError, authenticate, sendChat, type AuthResult } from "./lib/api.ts";
import { createDemoChatResponse, isDemoMode } from "./lib/demo.ts";
import { renderMarkdown } from "./lib/markdown.ts";

const SESSION_KEY = "festival-handover-session";
const PERSONA_KEY = "festival-handover-persona";
const QUESTION_EXAMPLES = [
  "今の時期にやることは？",
  "教室模擬と配置移動で事前に確認することは？",
  "雨天時の注意点は？",
  "前日に確認することをチェックリストにして",
  "関連する資料を教えて",
] as const;

interface ChatState {
  conversation: ConversationMessage[];
  responses: ChatResponse[];
}

export function mountApp(root: HTMLElement): void {
  if (isDemoMode()) {
    renderChat(root, { session_token: "demo-session", expires_at: "9999-12-31T23:59:59.999Z" }, true);
    return;
  }
  const session = readSession();
  if (session) renderChat(root, session);
  else renderAuth(root);
}

function renderAuth(root: HTMLElement, initialMessage = ""): void {
  root.innerHTML = `
    <main class="auth-layout">
      <header class="brand-panel" aria-labelledby="app-title">
        <p class="eyebrow">NAGATA FESTIVAL / HANDOVER</p>
        <h1 id="app-title">文化祭<br />引継ぎチャット</h1>
        <p class="brand-summary">過去の資料を探し、根拠を確かめ、次にすることを整理します。</p>
        <div class="document-status" aria-label="資料の状態">
          <span class="status-mark" aria-hidden="true"></span>
          <span>出典を表示して回答</span>
        </div>
      </header>

      <section class="auth-panel" aria-labelledby="auth-title">
        <div class="section-heading">
          <p class="section-kicker">試作版</p>
          <h2 id="auth-title">パスコードを入力</h2>
        </div>
        <form id="auth-form" novalidate>
          <label for="passcode">共通パスコード</label>
          <input id="passcode" name="passcode" type="password" autocomplete="current-password" maxlength="256" required aria-describedby="auth-hint auth-message" />
          <p id="auth-hint" class="field-hint">学校から案内されたパスコードを使用してください。</p>
          <button id="auth-submit" type="submit" disabled>認証して始める</button>
          <p id="auth-message" class="form-message" role="status" aria-live="polite"></p>
        </form>
        <p class="privacy-note">氏名・連絡先・認証情報は質問に入力しないでください。</p>
      </section>
    </main>
  `;

  const form = requireElement<HTMLFormElement>(root, "#auth-form");
  const input = requireElement<HTMLInputElement>(root, "#passcode");
  const submit = requireElement<HTMLButtonElement>(root, "#auth-submit");
  const message = requireElement<HTMLParagraphElement>(root, "#auth-message");
  if (initialMessage) setStatus(message, initialMessage, "error");

  input.addEventListener("input", () => {
    submit.disabled = input.value.trim().length === 0;
    setStatus(message, "", "idle");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const passcode = input.value.trim();
    if (!passcode) return;
    submit.disabled = true;
    submit.textContent = "確認中…";
    setStatus(message, "パスコードを確認しています。", "loading");

    void authenticate(passcode)
      .then((result) => {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
        input.value = "";
        renderChat(root, result);
      })
      .catch((error: unknown) => {
        setStatus(message, error instanceof Error ? error.message : "認証に失敗しました。もう一度お試しください。", "error");
        input.focus();
      })
      .finally(() => {
        submit.textContent = "認証して始める";
        submit.disabled = input.value.trim().length === 0;
      });
  });
}

function renderChat(root: HTMLElement, session: AuthResult, demoMode = false): void {
  const state: ChatState = { conversation: [], responses: [] };
  const savedPersona = localStorage.getItem(PERSONA_KEY);
  const initialPersona: PersonaId = includes(PERSONA_IDS, savedPersona) ? savedPersona : "standard";

  root.innerHTML = `
    <div class="chat-app">
      <header class="app-header">
        <div class="app-title-block">
          <span class="app-title-mark" aria-hidden="true"></span>
          <div>
            <p class="eyebrow">NAGATA FESTIVAL / HANDOVER</p>
            <h1>文化祭引継ぎチャット</h1>
          </div>
        </div>
        <div class="header-actions">
          <button class="button-secondary" id="new-chat" type="button">新しい会話</button>
          <button class="button-quiet" id="logout" type="button">終了</button>
        </div>
      </header>

      <main class="chat-layout">
        <aside class="control-panel" aria-label="回答条件">
          <div class="control-heading">
            <p class="section-kicker">回答条件</p>
            <p>質問に合わせて絞り込めます。</p>
          </div>
          <label for="persona">回答キャラクター</label>
          <select id="persona" name="persona">
            <option value="standard">あすとら — 元気に案内</option>
            <option value="concise">gemini — 通常</option>
            <option value="senior_supporter">すだゆう — 議論しながら確認</option>
          </select>
          <label for="part">パート</label>
          <select id="part" name="part">
            <option value="all">すべて</option>
            <option value="classroom_booths">教室模擬</option>
            <option value="layout_and_movement">配置移動</option>
            <option value="current_festival_records">今年度記録</option>
          </select>
          <label for="year">年度</label>
          <select id="year" name="year">
            <option value="all">すべて</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
          <p class="privacy-note">個人名・連絡先・認証情報は質問に含めないでください。</p>
        </aside>

        <section class="conversation-panel" aria-labelledby="conversation-title">
          <div class="conversation-heading">
            <div>
              <p class="section-kicker">資料検索</p>
              <h2 id="conversation-title">何を確認しますか？</h2>
            </div>
            <span class="session-status"><span aria-hidden="true"></span>${demoMode ? "UI確認モード" : "認証済み"}</span>
          </div>

          <div class="question-examples" aria-label="質問例">
            ${QUESTION_EXAMPLES.map((question) => `<button class="question-example" type="button" data-question="${question}">${question}</button>`).join("")}
          </div>

          <div id="messages" class="message-stream" aria-live="polite">
            <div class="empty-state">
              <p>回答には、確認できた資料名と見出しを表示します。</p>
              <p>資料に根拠がない場合は、その旨を明示します。</p>
            </div>
          </div>

          <form id="chat-form" class="composer">
            <label for="question">質問</label>
            <textarea id="question" name="question" rows="3" maxlength="2000" placeholder="例：4月に教室模擬が確認することは？" aria-describedby="question-count chat-status"></textarea>
            <div class="composer-footer">
              <span id="question-count">0 / 2,000</span>
              <button id="chat-submit" type="submit" disabled>資料を検索して質問</button>
            </div>
            <p id="chat-status" class="form-message" role="status" aria-live="polite"></p>
          </form>
        </section>
      </main>
    </div>
  `;

  const persona = requireElement<HTMLSelectElement>(root, "#persona");
  const part = requireElement<HTMLSelectElement>(root, "#part");
  const year = requireElement<HTMLSelectElement>(root, "#year");
  const form = requireElement<HTMLFormElement>(root, "#chat-form");
  const input = requireElement<HTMLTextAreaElement>(root, "#question");
  const submit = requireElement<HTMLButtonElement>(root, "#chat-submit");
  const count = requireElement<HTMLSpanElement>(root, "#question-count");
  const status = requireElement<HTMLParagraphElement>(root, "#chat-status");
  const messages = requireElement<HTMLDivElement>(root, "#messages");
  persona.value = initialPersona;

  persona.addEventListener("change", () => {
    if (includes(PERSONA_IDS, persona.value)) localStorage.setItem(PERSONA_KEY, persona.value);
  });
  input.addEventListener("input", () => updateComposer(input, submit, count, status));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!submit.disabled) form.requestSubmit();
    }
  });

  root.querySelectorAll<HTMLButtonElement>("[data-question]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.question ?? "";
      updateComposer(input, submit, count, status);
      input.focus();
    });
  });

  requireElement<HTMLButtonElement>(root, "#new-chat").addEventListener("click", () => {
    state.conversation = [];
    state.responses = [];
    renderMessages(messages, state, status);
    input.value = "";
    updateComposer(input, submit, count, status);
    input.focus();
  });
  requireElement<HTMLButtonElement>(root, "#logout").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    if (demoMode) window.history.replaceState(null, "", window.location.pathname);
    renderAuth(root);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question || !includes(PERSONA_IDS, persona.value) || !includes(PART_IDS, part.value)) return;
    const selectedYear = parseYear(year.value);
    if (selectedYear === null) return;

    submit.disabled = true;
    submit.textContent = "検索中…";
    setStatus(status, "資料を検索しています。", "loading");
    const request = {
      message: question,
      persona_id: persona.value,
      filters: { part: part.value as PartId, year: selectedYear },
      conversation: state.conversation.slice(-12),
    };

    const responsePromise = demoMode
      ? Promise.resolve(createDemoChatResponse(request))
      : sendChat(session.session_token, request);

    void responsePromise
      .then((response) => {
        state.conversation.push({ role: "user", content: question }, { role: "assistant", content: response.answer });
        state.conversation = state.conversation.slice(-12);
        state.responses.push(response);
        input.value = "";
        renderMessages(messages, state, status);
        setStatus(status, response.warning ?? "回答を表示しました。", response.grounding === "grounded" ? "success" : "error");
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === "UNAUTHORIZED") {
          sessionStorage.removeItem(SESSION_KEY);
          renderAuth(root, "セッションの有効期限が切れました。もう一度認証してください。");
          return;
        }
        setStatus(status, error instanceof Error ? error.message : "回答を取得できませんでした。入力内容を残しています。", "error");
      })
      .finally(() => {
        submit.textContent = "資料を検索して質問";
        submit.disabled = input.value.trim().length === 0;
        count.textContent = `${input.value.length.toLocaleString("ja-JP")} / 2,000`;
      });
  });
}

function renderMessages(container: HTMLElement, state: ChatState, status: HTMLElement): void {
  container.replaceChildren();
  if (state.responses.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "新しい質問を入力してください。";
    container.append(empty);
    return;
  }
  state.responses.forEach((response, index) => {
    const question = state.conversation[index * 2]?.content ?? "質問";
    const user = document.createElement("article");
    user.className = "message message-user";
    const userLabel = document.createElement("p");
    userLabel.className = "message-label";
    userLabel.textContent = "質問";
    const userText = document.createElement("p");
    userText.textContent = question;
    user.append(userLabel, userText);

    const assistant = document.createElement("article");
    assistant.className = "message message-assistant";
    const label = document.createElement("p");
    label.className = "message-label";
    label.textContent = response.persona.display_name;
    const answer = document.createElement("div");
    answer.className = "answer-text";
    answer.append(renderMarkdown(document, response.answer));
    assistant.append(label, answer);
    if (response.sources.length > 0) {
      const sourceTitle = document.createElement("h3");
      sourceTitle.textContent = "出典";
      const list = document.createElement("ul");
      list.className = "source-list";
      response.sources.forEach((source) => {
        const item = document.createElement("li");
        item.textContent = `${source.title} — 「${source.heading || "見出し不明"}」`;
        list.append(item);
      });
      assistant.append(sourceTitle, list);
    }
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "button-quiet copy-button";
    copy.textContent = "回答をコピー";
    copy.addEventListener("click", () => {
      void navigator.clipboard.writeText(response.answer)
        .then(() => setStatus(status, "回答をコピーしました。", "success"))
        .catch(() => setStatus(status, "コピーできませんでした。回答を選択してコピーしてください。", "error"));
    });
    assistant.append(copy);
    container.append(user, assistant);
  });
}

function updateComposer(input: HTMLTextAreaElement, submit: HTMLButtonElement, count: HTMLElement, status: HTMLElement): void {
  const length = input.value.length;
  count.textContent = `${length.toLocaleString("ja-JP")} / 2,000`;
  submit.disabled = input.value.trim().length === 0 || length > 2_000;
  if (status.dataset.state !== "loading") setStatus(status, "", "idle");
}

function readSession(): AuthResult | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("session_token" in value) || !("expires_at" in value)) return null;
    if (typeof value.session_token !== "string" || typeof value.expires_at !== "string") return null;
    if (Date.parse(value.expires_at) <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { session_token: value.session_token, expires_at: value.expires_at };
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function parseYear(value: string): YearId | null {
  if (value === "all") return "all";
  const numeric = Number(value);
  return includes(YEAR_IDS, numeric) ? numeric : null;
}

function includes<const T extends readonly unknown[]>(values: T, value: unknown): value is T[number] {
  return values.includes(value);
}

function setStatus(element: HTMLElement, message: string, state: "idle" | "loading" | "success" | "error"): void {
  element.textContent = message;
  element.dataset.state = state;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
}
