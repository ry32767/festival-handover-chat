export const PERSONA_IDS = ["standard", "concise", "senior_supporter"] as const;
export const PART_IDS = ["all", "classroom_booths", "layout_and_movement", "current_festival_records"] as const;
export const YEAR_IDS = ["all", 2024, 2025, 2026] as const;

export type PersonaId = (typeof PERSONA_IDS)[number];
export type PartId = (typeof PART_IDS)[number];
export type YearId = (typeof YEAR_IDS)[number];

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  message: string;
  persona_id: PersonaId;
  filters: { part: PartId; year: YearId };
  conversation: ConversationMessage[];
}

export interface SourceReference {
  source_id: string;
  title: string;
  heading: string;
}

export interface ChatResponse {
  answer: string;
  persona: { id: PersonaId; display_name: string };
  sources: SourceReference[];
  grounding: "grounded" | "insufficient";
  warning: string | null;
  request_id: string;
}

export interface ApiErrorBody {
  error: {
    code: "UNAUTHORIZED" | "INVALID_INPUT" | "RATE_LIMITED" | "NO_GROUNDED_ANSWER" | "UPSTREAM_ERROR" | "INTERNAL_ERROR";
    message: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function includes<const T extends readonly unknown[]>(values: T, value: unknown): value is T[number] {
  return values.includes(value);
}

export function parseChatRequest(value: unknown): ChatRequest | null {
  if (!isRecord(value) || typeof value.message !== "string") return null;
  const message = value.message.trim();
  if (message.length < 1 || message.length > 2_000) return null;
  if (!includes(PERSONA_IDS, value.persona_id)) return null;
  if (!isRecord(value.filters) || !includes(PART_IDS, value.filters.part) || !includes(YEAR_IDS, value.filters.year)) return null;
  if (!Array.isArray(value.conversation) || value.conversation.length > 12) return null;

  const conversation: ConversationMessage[] = [];
  for (const item of value.conversation) {
    if (!isRecord(item) || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") return null;
    const content = item.content.trim();
    if (content.length < 1 || content.length > 2_000) return null;
    conversation.push({ role: item.role, content });
  }

  return {
    message,
    persona_id: value.persona_id,
    filters: { part: value.filters.part, year: value.filters.year },
    conversation,
  };
}
