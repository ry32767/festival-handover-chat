type InlineToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; value: string }
  | { type: "emphasis"; value: string }
  | { type: "link"; label: string; href: string };

type Block =
  | { type: "heading"; level: 2 | 3 | 4; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "code"; code: string };

const MAX_HEADING_LEVEL = 4;

export function renderMarkdown(document: Document, markdown: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const blocks = parseBlocks(markdown);

  for (const block of blocks) {
    if (block.type === "heading") {
      const heading = document.createElement(`h${block.level}`);
      appendInlineContent(document, heading, block.text);
      fragment.append(heading);
      continue;
    }

    if (block.type === "paragraph") {
      const paragraph = document.createElement("p");
      appendInlineContent(document, paragraph, block.text);
      fragment.append(paragraph);
      continue;
    }

    if (block.type === "code") {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = block.code;
      pre.append(code);
      fragment.append(pre);
      continue;
    }

    const list = document.createElement(block.type === "ordered-list" ? "ol" : "ul");
    for (const itemText of block.items) {
      const item = document.createElement("li");
      appendInlineContent(document, item, itemText);
      list.append(item);
    }
    fragment.append(list);
  }

  return fragment;
}

function parseBlocks(markdown: string): Block[] {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const blocks: Block[] = [];
  const lines = normalized.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", code: codeLines.join("\n") });
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch?.[1] && headingMatch[2]) {
      blocks.push({
        type: "heading",
        level: Math.min(headingMatch[1].length + 1, MAX_HEADING_LEVEL) as 2 | 3 | 4,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*[-*]\s+/, "").trim());
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*\d+[.)]\s+/, "").trim());
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && shouldContinueParagraph(lines[index] ?? "")) {
      paragraphLines.push((lines[index] ?? "").trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function shouldContinueParagraph(line: string): boolean {
  return Boolean(line.trim())
    && !line.startsWith("```")
    && !/^(#{1,6})\s+/.test(line)
    && !/^\s*[-*]\s+/.test(line)
    && !/^\s*\d+[.)]\s+/.test(line);
}

function appendInlineContent(document: Document, parent: HTMLElement, text: string): void {
  for (const token of parseInline(text)) {
    if (token.type === "text") {
      parent.append(document.createTextNode(token.value));
      continue;
    }

    if (token.type === "code") {
      const code = document.createElement("code");
      code.textContent = token.value;
      parent.append(code);
      continue;
    }

    if (token.type === "strong") {
      const strong = document.createElement("strong");
      strong.textContent = token.value;
      parent.append(strong);
      continue;
    }

    if (token.type === "emphasis") {
      const emphasis = document.createElement("em");
      emphasis.textContent = token.value;
      parent.append(emphasis);
      continue;
    }

    const link = document.createElement("a");
    link.textContent = token.label;
    link.href = token.href;
    link.rel = "noreferrer";
    link.target = "_blank";
    parent.append(link);
  }
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let rest = text;

  while (rest.length > 0) {
    const next = findNextInline(rest);
    if (!next) {
      tokens.push({ type: "text", value: rest });
      break;
    }

    if (next.index > 0) tokens.push({ type: "text", value: rest.slice(0, next.index) });
    tokens.push(next.token);
    rest = rest.slice(next.index + next.length);
  }

  return tokens;
}

function findNextInline(text: string): { index: number; length: number; token: InlineToken } | null {
  const patterns: Array<{ pattern: RegExp; create: (match: RegExpExecArray) => InlineToken | null }> = [
    { pattern: /`([^`]+)`/, create: (match) => ({ type: "code", value: match[1] ?? "" }) },
    { pattern: /\*\*([^*]+)\*\*/, create: (match) => ({ type: "strong", value: match[1] ?? "" }) },
    { pattern: /\*([^*]+)\*/, create: (match) => ({ type: "emphasis", value: match[1] ?? "" }) },
    {
      pattern: /\[([^\]]+)\]\(([^)]+)\)/,
      create: (match) => {
        const href = match[2]?.trim() ?? "";
        if (!isSafeHref(href)) return null;
        return { type: "link", label: match[1] ?? "", href };
      },
    },
  ];

  let result: { index: number; length: number; token: InlineToken } | null = null;
  for (const entry of patterns) {
    const match = entry.pattern.exec(text);
    const token = match ? entry.create(match) : null;
    if (!match || !token) continue;
    if (!result || match.index < result.index) {
      result = { index: match.index, length: match[0].length, token };
    }
  }

  return result;
}

function isSafeHref(href: string): boolean {
  return href.startsWith("https://") || href.startsWith("http://") || href.startsWith("mailto:");
}
