import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { readUtf8 } from "./file-utils.ts";

interface ImportTarget {
  source: string;
  destination: string;
  sourceId: string;
  title: string;
  part: "classroom_booths" | "layout_and_movement" | "current_festival_records";
  highRisk?: boolean;
}

interface Finding {
  label: string;
  line: number;
}

const targets: readonly ImportTarget[] = [
  { source: "master.md", destination: "master.md", sourceId: "COMP-MASTER-001", title: "文化祭引継ぎナレッジ統合版", part: "current_festival_records" },
  { source: "glossary.md", destination: "glossary.md", sourceId: "COMP-GLOSSARY-001", title: "文化祭引継ぎ用語集", part: "current_festival_records" },
  { source: "unresolved_issues.md", destination: "unresolved_issues.md", sourceId: "COMP-UNRESOLVED-001", title: "文化祭引継ぎ未解決事項", part: "current_festival_records" },
  { source: "details/01_実行委員長_副委員長_全体運営.md", destination: "01_overall_operations.md", sourceId: "COMP-DETAIL-001", title: "実行委員長・副委員長・全体運営", part: "current_festival_records" },
  { source: "details/02_合同会議_全体スケジュール.md", destination: "02_schedule.md", sourceId: "COMP-DETAIL-002", title: "合同会議・全体スケジュール", part: "current_festival_records" },
  { source: "details/03_教室模擬パート.md", destination: "03_classroom_booths.md", sourceId: "COMP-DETAIL-003", title: "教室模擬パート", part: "classroom_booths" },
  { source: "details/04_食品模擬_1年企画.md", destination: "04_food_and_first_year.md", sourceId: "COMP-DETAIL-004", title: "食品模擬・1年企画", part: "current_festival_records" },
  { source: "details/05_総務パート.md", destination: "05_general_affairs.md", sourceId: "COMP-DETAIL-005", title: "総務パート", part: "current_festival_records" },
  { source: "details/06_展示_野外_講堂.md", destination: "06_exhibition_and_stages.md", sourceId: "COMP-DETAIL-006", title: "展示・野外・講堂", part: "current_festival_records" },
  { source: "details/07_配置移動_会計.md", destination: "07_layout_and_accounting.md", sourceId: "COMP-DETAIL-007", title: "配置移動・会計", part: "layout_and_movement" },
  { source: "details/08_文化祭の友_デザイン_装飾.md", destination: "08_design_and_decoration.md", sourceId: "COMP-DETAIL-008", title: "文化祭の友・デザイン・装飾", part: "current_festival_records" },
  { source: "details/09_事後アンケート_反省_議事録.md", destination: "09_feedback_and_minutes.md", sourceId: "COMP-DETAIL-009", title: "事後アンケート・反省・議事録", part: "current_festival_records" },
  { source: "details/10_webサイト班_過去資料アーカイブ.md", destination: "10_web_archive.md", sourceId: "COMP-DETAIL-010", title: "Webサイト班・過去資料アーカイブ", part: "current_festival_records", highRisk: true },
] as const;

const detectors = [
  { label: "email", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu },
  { label: "phone", pattern: /(?:0\d{1,4}[-ー\s]\d{1,4}[-ー\s]\d{3,4}|0\d{9,10})/gu },
  { label: "LINE identifier", pattern: /LINE\s*(?:ID|アカウント)?\s*[:：]\s*@?[A-Z0-9._-]+/giu },
  { label: "credential", pattern: /(?:パスワード|password|passcode|secret)\s*(?:[:：=]|は)\s*`?[^`、。\s]+`?/giu },
] as const;

async function main(): Promise<void> {
  const stagingRoot = path.resolve("99_LLM用");
  const destinationRoot = path.resolve("knowledge", "40_compilations");
  const reportPath = path.resolve("knowledge", "90_indexes", "llm_import_report.md");
  await mkdir(destinationRoot, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const promoted: ImportTarget[] = [];
  const quarantined: Array<{ target: ImportTarget; findings: Finding[] }> = [];
  for (const target of targets) {
    const content = await readUtf8(path.join(stagingRoot, target.source));
    const findings = detectSensitiveContent(content);
    if (target.highRisk) findings.push({ label: "manual review required", line: 1 });
    const uniqueFindings = deduplicateFindings(findings);
    const destination = path.join(destinationRoot, target.destination);
    if (uniqueFindings.length > 0) {
      await unlink(destination).catch(() => undefined);
      quarantined.push({ target, findings: uniqueFindings });
      continue;
    }
    await writeFile(destination, `${createFrontMatter(target)}${content}`, "utf8");
    promoted.push(target);
  }

  await writeFile(reportPath, createReport(promoted, quarantined), "utf8");
  console.log(`LLM knowledge import completed: ${promoted.length} promoted, ${quarantined.length} quarantined`);
  for (const item of quarantined) console.log(`QUARANTINED ${item.target.source}: ${item.findings.map((finding) => `${finding.label}@${finding.line}`).join(", ")}`);
}

function detectSensitiveContent(content: string): Finding[] {
  const findings: Finding[] = [];
  content.split(/\r?\n/u).forEach((line, index) => {
    for (const detector of detectors) {
      detector.pattern.lastIndex = 0;
      if (detector.pattern.test(line)) findings.push({ label: detector.label, line: index + 1 });
    }
  });
  return findings;
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.label}:${finding.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createFrontMatter(target: ImportTarget): string {
  return [
    "---",
    `source_id: ${target.sourceId}`,
    `title: ${target.title}`,
    `part: ${target.part}`,
    "document_type: compiled_handover",
    "year_from: 2024",
    "year_to: 2026",
    "status: final",
    "reliability: medium",
    "anonymized: true",
    `original_path: 99_LLM用/${target.source}`,
    "derived: true",
    "---",
    "",
  ].join("\n");
}

function createReport(promoted: readonly ImportTarget[], quarantined: ReadonlyArray<{ target: ImportTarget; findings: readonly Finding[] }>): string {
  const lines = [
    "# LLM用資料 取り込みレポート",
    "",
    "> 自動検査結果。機密値は記録しない。同期前には引き続き人間レビューが必要。",
    "",
    `- 取り込み: ${promoted.length}件`,
    `- 隔離: ${quarantined.length}件`,
    "- 除外: README.md、source_index.md、folder_tree.md",
    "",
    "## 取り込み済み",
    "",
    ...promoted.map((target) => `- \`${target.source}\` → \`knowledge/40_compilations/${target.destination}\``),
    "",
    "## 隔離中",
    "",
    ...quarantined.map(({ target, findings }) => `- \`${target.source}\`: ${findings.map((finding) => `${finding.label} (line ${finding.line})`).join(", ")}`),
    "",
  ];
  return lines.join("\n");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
