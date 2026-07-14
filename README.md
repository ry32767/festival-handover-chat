# 文化祭引継ぎチャット

> 教室模擬・配置移動・今年度中心の文化祭資料を横断検索し、次年度スタッフに出典付きで回答する引継ぎ支援Webアプリ。

文化祭資料が膨大でも、利用者は1画面のチャットから質問できます。資料は匿名化したMarkdownとして保持し、GeminiのFile Searchを用いて関連箇所だけを検索します。回答キャラクターは「あすとら」「gemini」「すだゆう」から選択できます。

## 主な機能
- **資料横断検索** — 教室模擬、配置移動、今年度・一部昨年度のMarkdown資料をまとめて検索
- **出典付き回答** — 回答の根拠としてファイル名と見出しを表示
- **キャラクター選択** — あすとら、gemini、すだゆうの3キャラクター
- **パート・年度フィルタ** — 検索対象を絞り込み
- **非技術者向けUI** — 質問例、回答コピー、スマートフォン対応
- **安全なAPI利用** — Gemini APIキーをフロントエンドに置かず、Supabase Edge Functions経由で呼び出す

> 詳細仕様と受け入れ条件は [docs/spec.md](docs/spec.md)。

## 技術スタック
- **Frontend**: TypeScript + Vite（静的SPA）
- **Hosting**: GitHub Pages
- **Backend**: Supabase Edge Functions（Deno / TypeScript）
- **AI**: Gemini API + File Search
- **Knowledge**: 匿名化済みMarkdown
- **Test**: Vitest + Playwright + Deno test

## フォルダ構成

```text
festival-handover-chat/
├── README.md
├── AGENTS.md
├── CLAUDE.md                  # Claude Code用の薄い作業ラッパ
├── DESIGN.md                   # UIトークンとデザイン判断
├── package.json
├── docs/
│   ├── README.md
│   ├── spec.md
│   ├── knowledge-architecture.md
│   └── security.md
├── src/                         # GitHub Pages向けフロントエンド
├── shared/                      # ブラウザ・Edge Function共通API契約
├── supabase/
│   ├── config.toml
│   └── functions/
│       ├── festival-auth/       # 認証API（現在は安全な未実装応答）
│       └── festival-chat/       # チャットAPI（現在は安全な未実装応答）
├── knowledge/
│   ├── 00_core/
│   ├── 10_domains/
│   ├── 20_topics/
│   ├── 30_sources/
│   ├── 40_compilations/
│   ├── 80_personas/
│   └── 90_indexes/
├── scripts/
│   ├── validate-knowledge.ts
│   ├── anonymization-check.ts
│   └── sync-file-search.ts
├── tests/e2e/
└── .github/workflows/pages.yml
```

## セットアップ

必要環境はNode.js 22以上です。Edge Functionをローカル起動する場合はDocker互換環境も必要です。

```bash
npm install
npm run dev
```

フロントエンドは `http://127.0.0.1:5173` で起動します。PowerShellの実行ポリシーで`npm`が拒否される環境では、`npm.cmd run dev`を使用してください。

Edge Functionは別ターミナルで起動します。

```bash
npm run auth:setup
npm run supabase:functions:serve
npm run functions:test
```

`auth:setup`は試作用のランダムな共通パスコードを、コマンドを実行したターミナルに1度だけ表示します。ブラウザには表示しません。ハッシュと署名SecretはGit管理外の`supabase/functions/.env.local`へ保存し、既存ファイルは上書きしません。PowerShellでは`npm.cmd run auth:setup`を使用してください。本番SecretはSupabaseのSecrets管理へ別途登録してください。

環境変数名は [.env.example](.env.example) を参照してください。`GEMINI_API_KEY`、パスコード関連Secret、署名Secretはブラウザ向け環境変数やGitHubへコミットしません。

### 現在の実装範囲

Phase 0の開発基盤に加え、共通パスコード認証、短期署名セッション、認証後のチャット画面を実装済みです。`99_LLM用/`から検査済みファイルだけを検索候補へ取り込む処理、Gemini File Search Storeへのブルーグリーン同期、問い合わせ、citation正規化を実装しています。APIキー、モデル、Store名が未設定の場合は安全な`503`を返します。

主要な検証コマンド:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run functions:test
npm run security:scan
npm run build
```

`99_LLM用/`を検索対象候補へ反映するときは、次を先に実行します。連絡先・認証情報などを検出したファイルは`knowledge/40_compilations/`へ取り込まず、`knowledge/90_indexes/llm_import_report.md`へ隔離理由だけを記録します。

```bash
npm run knowledge:import-llm
npm run knowledge:validate
npm run knowledge:anonymization-check
npm run knowledge:sync -- --dry-run
npm run knowledge:verify
```

管理者が新しいGemini File Search Storeへ実同期するときは、dry-runと匿名化確認後に`npm run knowledge:sync -- --execute`を実行します。成功時だけ表示されたStore名を`GEMINI_FILE_SEARCH_STORE`へ設定し、`knowledge:verify`で引用付き回答を確認します。同期処理は既存Storeを削除・上書きしません。

## 使い方

1. 公開URLを開く
2. 試作版では共通パスコードを入力する
3. パート・年度・回答キャラクターを必要に応じて選ぶ
4. 質問例ボタンを押すか、自由に質問する
5. 回答と「ファイル名＋見出し」の出典を確認する

### UI確認モード

ローカル画面を`http://127.0.0.1:4173/?demo=1`のように`?demo=1`付きで開くと、認証とSupabase Edge Functionsを使わずにチャット画面を確認できます。質問送信時は実資料を検索せず、明示されたサンプル回答とサンプル出典を表示します。このモードは`localhost`または`127.0.0.1`でのみ有効です。

AIの回答は引継ぎ支援です。安全、食品、会計、個人情報、教員判断に関わる事項は、表示された確認先へ最終確認してください。

## 資料更新

あなたと次年度チーフがGitHubのWeb画面から匿名化済みMarkdownを更新します。更新後、管理者が同期スクリプトを手動実行し、Gemini File Search Storeを更新します。

現時点の同期コマンドはdry-run専用です。実同期はPhase 2で実装します。

```bash
npm run knowledge:sync -- --dry-run
```

## 開発者・AIエージェント向け
- 作業規約・検証ループ: [AGENTS.md](AGENTS.md)
- Claude Code用の補足: [CLAUDE.md](CLAUDE.md)
- 仕様・受け入れ条件: [docs/spec.md](docs/spec.md)
- ナレッジ構造: [docs/knowledge-architecture.md](docs/knowledge-architecture.md)
- セキュリティ: [docs/security.md](docs/security.md)
- UIデザイン判断: [DESIGN.md](DESIGN.md)

## ライセンス
未定。学校内部資料の扱いを含むため、本運用前に公開範囲とライセンスを確定してください。
