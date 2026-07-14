# AGENTS.md

> このプロジェクトでコードを書くすべてのAIエージェント共通の作業規約。作業前に必ず読むこと。

## ドキュメントの役割
- **README.md**: 人間向けの概要・セットアップ・使い方
- **AGENTS.md**: 作業規約・コマンド・検証ループ・ドキュメント同期規約
- **CLAUDE.md**: `AGENTS.md`を読み込むClaude Code用ラッパと一次資料整理時の補足
- **docs/spec.md**: 実装契約。機能・受け入れ条件・MVP・タスク
- **docs/knowledge-architecture.md**: Markdown資料の構造、出典、圧縮、同期方式
- **docs/security.md**: 秘密情報、匿名化、認証、API防御
- **docs/README.md**: docs索引
- **DESIGN.md**: UIトークンとデザイン判断。UI変更前に確認する

## Tech Stack
| レイヤー | 技術 |
|---|---|
| Frontend | TypeScript + Vite、静的SPA |
| Hosting | GitHub Pages |
| Backend | Supabase Edge Functions / Deno / TypeScript |
| AI | Gemini API + File Search |
| Storage | Gitリポジトリ内の匿名化Markdown、Gemini File Search Store |
| Test | Vitest、Playwright、Deno test |

## Commands

> 雛形作成時に実コマンドへ更新すること。コマンド名を変更した場合、READMEとこのファイルを同じコミットで更新する。

```bash
npm install
npm run dev
npm run test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
npm run security:scan
npm run functions:test
npm run knowledge:validate
npm run knowledge:anonymization-check
npm run knowledge:import-llm
npm run knowledge:verify
npm run knowledge:sync -- --dry-run
npm run knowledge:sync -- --execute
npm run supabase:functions:serve
```

## Verification Loop
1. 実装する
2. 関連する自動テストを追加または更新する
3. `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`を実行する
4. Edge Function変更時は`npm run functions:test`とローカル呼び出しを実行する
5. 資料構造変更時は`knowledge:validate`と`knowledge:anonymization-check`を実行する
6. `docs/spec.md`の受け入れ条件を1件ずつ照合する
7. 手動確認項目を実施し、結果を報告する
8. 失敗・未達が1件でもあれば修正して2へ戻る

テスト、Lint、型、ビルド、匿名化検査が失敗した状態で完了としない。

## 実装原則
- APIキー、共通パスコードのハッシュ、Supabase秘密情報をフロントエンドへ出さない
- フロントエンドから送る`persona_id`、`part`、`year`を信用しない。サーバー側の許可リストで検証する
- キャラクター設定は表現層に限定し、共通ポリシー・安全判断・出典規則より優先させない
- Geminiのモデル名、File Search Store名、制限値は環境変数または設定ファイルで差し替え可能にする
- 資料にない情報を生成させる方向のプロンプトを追加しない
- 出典を返せない場合は、断定的な回答を避ける
- 既存の資料ID、見出しアンカー、`source_id`を理由なく変更しない
- 依存追加は必要性を説明し、最小限にする
- TypeScriptで`any`を常用しない
- ユーザー向けエラーに内部APIレスポンスや秘密情報を含めない

## ナレッジ更新規約
- 取り込み対象は匿名化済みファイルのみ
- 元資料を削って圧縮しない。`30_sources`に根拠を残し、上位層は参照IDで結ぶ
- 事実、担当者の評価、提案、未確定事項を明確に分ける
- 年度を省略しない。年度不明なら`year: unknown`とする
- 同一事項の矛盾は片方を消さず、`90_indexes/conflicts.md`へ記録する
- 更新前に同期対象の差分と削除予定をdry-runで確認する
- 同期失敗時に既存の本番Storeを破壊しない。新Storeへ投入・検証後に切り替える

## ドキュメント同期規約
- 機能、受け入れ条件、MVP、制限変更 → `docs/spec.md`
- ナレッジ階層、front matter、同期方式変更 → `docs/knowledge-architecture.md`
- 認証、秘密情報、匿名化、ログ方針変更 → `docs/security.md`
- セットアップ、使い方、フォルダ構成変更 → `README.md`
- docsを増減 → `docs/README.md`

コードとドキュメントは同じ変更で更新する。仕様と実装がずれた状態で完了としない。

## Do NOT
- `GEMINI_API_KEY`をGitHub、JavaScript bundle、ブラウザStorageへ保存しない
- 共通パスコードを平文でリポジトリやログへ残さない
- GitHub PagesだけでAPI呼び出しを完結させない
- UIで非表示にするだけのアクセス制御を実装しない
- 個人名、連絡先、LINEアカウント、個人評価を検索Storeへ投入しない
- キャラクターMarkdownから任意コードや外部URLを実行しない
- フィードバック本文や質問全文を無期限保存しない
- 仕様変更時にdocsを放置しない
