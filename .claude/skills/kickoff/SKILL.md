---
name: kickoff
description: テンプレートからコピーした直後の新規プロジェクトを初期設定する。プロジェクト名・技術スタックの決定、CLAUDE.md の具体化、雛形生成、git 初期化まで。「プロジェクトを始めたい」「初期設定して」というときに使う。
---

# プロジェクト初期設定

前提: このフォルダは ClaudePJTemplate からコピーされた直後の状態。

1. AskUserQuestion で以下を確認する
   - プロジェクト名と一言での概要
   - 技術スタック(例: Next.js / React + Vite / その他)。推奨があれば理由付きで示す
   - デプロイ先や制約(あれば)
2. CLAUDE.md の TODO をすべて実際の内容に置き換える。TODO コメントを残さない
3. README.md をこのプロジェクト用の README に書き換える
4. スタックに応じた雛形を生成する(`npm create vite@latest` など公式スキャフォールドを優先)。
   生成物の .gitignore や設定と、テンプレート由来の .gitignore / .claude/ が衝突しないよう統合する
5. dev / test / build / lint コマンドを実際に動かして確認し、CLAUDE.md の「コマンド」に記録する
6. `git init -b main` して初回コミットを提案する
7. 最後に「/spec 機能名 で最初の機能の要件定義から始められます」と案内する
