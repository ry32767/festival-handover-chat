# ナレッジ構造設計

## 1. 目的

教室模擬引継ぎ資料、配置移動引継ぎ資料、今年度中心・一部昨年度の既存Markdown資料群を、次の条件で扱う。

- 原情報を失わない
- 通常回答で毎回全資料を送らない
- 年度、パート、事実・意見・提案を区別する
- 回答から根拠ファイルと見出しへ戻れる
- 次年度チーフがMarkdownを更新できる
- 矛盾や未確定事項を隠さない

## 2. 設計原則

圧縮は削除ではなく階層化で行う。

```text
原文・詳細ソース（100%）
        ↓ 構造化
パート別・トピック別統合（10〜40%）
        ↓ 要点抽出
コア知識（2〜10%）
```

Gemini File Searchには検索に必要な全層を投入する。ただし、同じ文章を大量複製せず、上位層から`source_id`で下位層へ参照する。

## 3. ディレクトリ構造

```text
knowledge/
├── 00_core/
│   ├── system_policy.md
│   ├── safety_policy.md
│   ├── answer_format.md
│   ├── festival_overview.md
│   ├── annual_roadmap.md
│   ├── parts_overview.md
│   └── critical_rules.md
├── 10_domains/
│   ├── classroom_booths/
│   │   ├── overview.md
│   │   ├── procedures.md
│   │   ├── collaboration.md
│   │   ├── changes_and_lessons.md
│   │   └── source_map.md
│   ├── layout_and_movement/
│   │   └── 同上
│   └── current_festival_records/
│       ├── overview.md
│       ├── decisions.md
│       ├── operations.md
│       ├── changes_and_lessons.md
│       └── source_map.md
├── 20_topics/
│   ├── schedule.md
│   ├── equipment.md
│   ├── classroom_layout.md
│   ├── crowd_control.md
│   ├── safety.md
│   ├── rain_response.md
│   ├── cleanup.md
│   ├── communication.md
│   └── collaboration.md
├── 30_sources/
│   ├── classroom_booths/
│   ├── layout_and_movement/
│   └── current_festival_records/
├── 40_compilations/
│   └── 匿名化検査済みのLLM用統合資料
├── 80_personas/
│   ├── persona_index.md
│   ├── standard.md
│   ├── concise.md
│   └── senior_supporter.md
└── 90_indexes/
    ├── source_index.md
    ├── topic_index.md
    ├── terminology.md
    ├── conflicts.md
    ├── unresolved_questions.md
    └── anonymization_report.md
```

## 4. 各層の責務

### 4.1 `00_core`

全回答の前提となる短い正典。最重要ルール、パート構成、年度の扱い、回答規則を置く。

- 目安: 1ファイル1,000〜4,000字
- 過去の細かい事例は置かない
- 正式ルールと判断基準を優先
- 全回答で共通参照する

### 4.2 `10_domains`

パート単位で業務を統合する。教室模擬、配置移動、今年度記録を同じ構造にそろえる。

- `overview.md`: 役割、担当範囲、担当外、主要連携先
- `procedures.md` / `operations.md`: 時期別・業務別手順
- `collaboration.md`: 他パートとの責任境界
- `changes_and_lessons.md`: 変更理由、結果、反省、提案
- `source_map.md`: 統合記述と元資料の対応

### 4.3 `20_topics`

パート横断事項をまとめる。暗幕、机椅子、列形成、雨天、撤収など、複数パートにまたがる問題を一か所から探せるようにする。

### 4.4 `30_sources`

情報を失わないための根拠層。元資料1件につき原則1Markdownとする。既にMarkdownの資料も、front matterを付けた上でここへ登録するか、原文パスを保持して検索対象へ含める。

`SourceDocs/`由来の引継ぎ書アーカイブを閲覧・検索対象へ昇格する場合もこの層に置き、`document_type: source_archive`・`derived: true`・`original_path: SourceDocs/...`を付ける。原本は無変更のまま、匿名化コピーだけをここへ置く。氏名・あだ名の除去（人間確認）と`knowledge:validate`・`knowledge:anonymization-check`合格を昇格条件とし、承認外ファイルは既定で非公開とする（詳細は [security.md](security.md) の「原本アーカイブの公開ゲート」）。

### 4.5 `80_personas`

回答の表現層。人物名、文体、回答構成、質問方法を定義する。共通ポリシーを上書きできない。

### 4.5a `40_compilations`

`99_LLM用/`で作成された統合版・用語集・パート別詳細のうち、匿名化検査と人間確認を通過した派生資料を置く。元資料そのものではないため`derived: true`を付け、`original_path`で中間成果物へ戻れるようにする。連絡先、認証情報、個人名を検出したファイルは取り込まず、`90_indexes/llm_import_report.md`へ機密値を含めずに隔離理由を記録する。

### 4.6 `90_indexes`

資料発見、矛盾、未確定、匿名化状態を管理する。

## 5. Source Markdown形式

```md
---
source_id: SRC-CB-001
title: 教室模擬引継ぎ書2025-2026
part: classroom_booths
document_type: handover
year_from: 2025
year_to: 2026
status: final
reliability: high
anonymized: true
original_path: 教室模擬引継ぎ資料/引継ぎ書/教室模擬引継ぎ書2025-2026.pdf
source_format: pdf
---

# 資料概要

## 対象と目的
...

# 原文・詳細内容

## 12月：模擬プレゼン準備
...

# 構造化情報

## 確認済みの事実
...

## 担当者による評価
...

## 来年度への提案
...

## 未確定事項
...
```

## 6. Front matter必須項目

| 項目 | 型 | 説明 |
|---|---|---|
| `source_id` | string | 永続的な一意ID |
| `title` | string | 出典表示用の資料名 |
| `part` | enum | `classroom_booths`等 |
| `document_type` | enum | handover, minutes, form, map, checklist, compiled_handover, source_archive等 |
| `year_from`, `year_to` | number/string | 適用年度。不明は`unknown` |
| `status` | enum | draft, final, archived, reference |
| `reliability` | enum | high, medium, low |
| `anonymized` | boolean | falseは同期禁止 |
| `original_path` | string | 元資料の相対パス |

## 7. 記述規則

### 7.1 1見出し1テーマ

検索チャンクが意味を保つように、複数の無関係な話題を同じ見出しに詰め込まない。

### 7.2 主語と対象を明記

「これ」「そこ」「去年」などの文脈依存表現を避け、パート名、物品名、年度を書く。

### 7.3 情報種別を分離

```md
### 確認済みの事実
### 当時の担当者による評価
### 次年度への提案
### 未確認・要確認
```

### 7.4 年度優先順位

通常は次の順で扱う。

1. 対象年度の正式・最終資料
2. 対象年度の正式資料
3. 直近年度の引継ぎ
4. 議事録・作業記録
5. 個人の評価・提案

この優先順位で解消できない矛盾は断定しない。

## 8. 矛盾管理

`90_indexes/conflicts.md`に双方を残す。

```md
## CONFLICT-001 暗幕の担当範囲

### 主張A
- source: SRC-CB-008
- content: 必要数の回収は教室模擬が担当

### 主張B
- source: SRC-LM-004
- content: 暗幕貸出全体を配置移動が担当

### 暫定整理
- 必要数回収: 教室模擬
- 現物管理・貸出: 配置移動
- 最終責任者: 未確認

### 確認先
教室模擬チーフ、配置移動チーフ、担当教員
```

## 9. 匿名化

### 削除・置換対象
- 生徒・教員の氏名
- 電話番号、個人メール、SNS・LINE識別子
- 個人を特定できるクラス内評価
- 不要な会計口座情報
- 校内限定の認証情報

### 保持してよい情報
- 役職名
- パート名
- クラス番号。ただし出来事との組合せで個人特定につながる場合は一般化
- 金額や数量など運営判断に必要な集計値
- 匿名化された過去事例

匿名化は投入前に実施し、`anonymized: true`かつ自動検査通過時のみ同期する。完全自動匿名化はMVP外で、人間レビューを必須とする。

## 10. File Search同期

### 10.1 基本方式

1. GitHub上のMarkdownを更新
2. `99_LLM用/`を更新した場合は`knowledge:import-llm`で安全なファイルだけを`40_compilations`へ反映
3. 構造・front matter・匿名化を検査
4. 差分一覧をdry-run表示
5. 新しいFile Search Storeへ全対象を投入
6. 代表質問を実行して検証
7. 合格後、バックエンドの参照Store名を切り替える
8. 旧Storeは一定期間保持後に手動削除

### 10.2 理由

差分更新だけで削除や重複が不整合になるリスクを避け、同期失敗時も既存Storeを維持するため、試作ではブルーグリーン方式を採用する。

### 10.3 チャンク

初期値はAPI既定値を使用する。代表質問で検索漏れが出た場合のみ調整する。見出し単位の意味が保たれるようMarkdownを先に整えることを優先し、チャンク値を無根拠に最適化しない。

## 11. 出典

APIから得た引用情報と、各Markdownのfront matter・見出しを対応付け、利用者には次を表示する。

```text
教室模擬引継ぎ書2025-2026 — 「4月：本企画書」
配置移動引継ぎ書2026 — 「前日：暗幕の受け渡し」
```

原文抜粋はMVPでは表示しない。出典ファイル名と見出しを返せない回答は「十分な根拠を取得できませんでした」と明示する。

## 12. キャラクター

- `standard` / あすとら
- `concise` / gemini
- `senior_supporter` / すだゆう

フロントエンドは`persona_id`だけを送る。バックエンドが許可済みファイルを読み込み、共通ポリシーの後に追加する。キャラクターMarkdownをFile Searchの一般資料として検索させず、サーバー側設定として明示的に読み込む。
