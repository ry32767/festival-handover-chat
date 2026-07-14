import type { ChatRequest, ChatResponse, PersonaId } from "../../shared/api-contracts.ts";

const PERSONA_NAMES: Record<PersonaId, string> = {
  standard: "あすとら",
  concise: "gemini",
  senior_supporter: "すだゆう",
};

export function isDemoMode(location: Pick<Location, "hostname" | "search"> = window.location): boolean {
  const isLoopback = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  return isLoopback && new URLSearchParams(location.search).get("demo") === "1";
}

export function createDemoChatResponse(request: ChatRequest): ChatResponse {
  const part = request.filters.part === "all" ? "すべてのパート" : request.filters.part;
  const year = request.filters.year === "all" ? "全年度" : `${request.filters.year}年度`;
  return {
    answer: `これはUI確認用のサンプル回答です。実資料は検索していません。\n\n質問「${request.message}」を、${part}・${year}の条件で受け付けました。本番接続後は、ここに結論、次の行動、確認先を表示します。`,
    persona: { id: request.persona_id, display_name: PERSONA_NAMES[request.persona_id] },
    sources: [{
      source_id: "demo-source",
      title: "UI確認用サンプル資料（実資料ではありません）",
      heading: "回答表示サンプル",
    }],
    grounding: "insufficient",
    warning: "UI確認モードです。表示内容は実資料に基づく回答ではありません。",
    request_id: crypto.randomUUID(),
  };
}
