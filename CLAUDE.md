# CLAUDE.md

> Claude Code はこのファイルを自動で読み込みます。共通の作業規約・コマンド・検証ループは [AGENTS.md](AGENTS.md) に一元化しています。

@AGENTS.md

## 一次資料整理時の補足

- 作業前に [docs/knowledge-architecture.md](docs/knowledge-architecture.md) と [docs/security.md](docs/security.md) を読む
- `SourceDocs/`と各種ZIPは原本として扱い、変更・移動・削除しない
- 要約・抽出・統合の中間成果物は`99_LLM用/`へ保存する
- 一次資料は一度に全件処理せず、フォルダまたは年度単位の小さなバッチに分ける
- 各記述に元ファイル、見出し、年度を残し、根拠を追跡できるようにする
- 事実、担当者の評価、次年度への提案、未確定事項を混ぜない
- 矛盾は片方を消さず、中間成果物内で双方と出典を記録する
- 人名、連絡先、メール、LINE識別子、個人評価、認証情報を中間成果物へ転記しない
- 不明な情報は推測で補わず、年度不明は`unknown`、内容不明は未確定として残す
- `99_LLM用/`の内容を直接`knowledge/`へ移動したり、File Searchへ同期したりしない
- `knowledge/`への反映は、人間による匿名化・出典・内容の確認後に行う
