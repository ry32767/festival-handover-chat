// 匿名化検査で共有する機密パターンと承認済み業者連絡先。
// import-llm-knowledge.ts（取り込み時の隔離判定）と anonymization-check.ts（同期前の検査）の
// 両方がこのモジュールを使い、検出ロジックが分岐しないようにする。
// 過去、2スクリプトで正規表現が食い違い、`パスワード `値`` 形式の認証情報が
// 取り込み検査をすり抜けた事例があったため、単一の情報源に統一している。

export interface SensitivePattern {
  label: string;
  pattern: RegExp;
}

export const sensitivePatterns: readonly SensitivePattern[] = [
  { label: "email", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu },
  { label: "phone", pattern: /(?:0\d{1,4}[-ー\s]\d{1,4}[-ー\s]\d{3,4}|0\d{9,10})/gu },
  { label: "LINE identifier", pattern: /LINE\s*(?:ID|アカウント)?\s*[:：]\s*@?[A-Z0-9._-]+/giu },
  // 認証情報。`パスワード: 値` に加え、区切りが無い `パスワード `値`` 形式（バッククォート・全角/半角スペース区切り）も検出する。
  // 値部分は英数字トークン（5文字以上）を要求するため、`パスワードは別途管理` のような日本語散文には誤反応しない。
  { label: "credential", pattern: /(?:パスワード|password|passcode|secret)\s*(?:[:：=]|は|\s)*`?[A-Za-z0-9][A-Za-z0-9_@.-]{4,}`?/giu },
];

// 承認済み業者（法人）の公開連絡先。生徒・教員個人ではないため、人間レビューの上で
// 許可リストとして検出から除外する。個人メール・個人電話・LINE識別子・認証情報は追加しない。
// 変更時は docs/security.md「業者連絡先の許可リスト」節も同じコミットで更新すること。
export const approvedBusinessContacts: ReadonlySet<string> = new Set(
  [
    "078-453-2421", // 株式会社兵永 TEL
    "078-453-2437", // 株式会社兵永 FAX
    "hyouei-eigyou@hyouei.co.jp", // 株式会社兵永 業者メール
    "03-6240-9227", // リアライズ TEL
    "050-5357-7324", // ステッカージャパン TEL
    "078-611-3695", // インテリアさんのみや TEL
  ].map((value) => value.toLowerCase()),
);

export interface SensitiveFinding {
  label: string;
  line: number;
}

// 承認済み業者連絡先を除外したうえで、1行ごとに機密パターンを検出する。
export function scanSensitiveContent(content: string): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  content.split(/\r?\n/u).forEach((line, index) => {
    for (const { label, pattern } of sensitivePatterns) {
      pattern.lastIndex = 0;
      const matches = line.match(pattern) ?? [];
      const flagged = matches.filter((match) => !approvedBusinessContacts.has(match.trim().toLowerCase()));
      if (flagged.length > 0) findings.push({ label, line: index + 1 });
    }
  });
  return findings;
}
