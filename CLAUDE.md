# schedule-planner(スケジュール計画立案)

## 概要

帰宅後〜就寝までにやることを登録すると、現在時刻をもとに「今夜のスケジュール」を自動で立てる個人用アプリ。
目的は帰宅後の YouTube ダラ見による時間の浪費を減らすこと。

- 利用者: 本人のみ(Android スマホから利用)
- 利用方法: PC で開発サーバを起動し、同じ自宅 Wi-Fi のスマホから `http://<PCのIP>:5173` を開く
- 制約: 完全ローカル運用。データは端末のブラウザ内にのみ保存し、外部に送信しない

## 技術スタック

- React 19 + TypeScript + Vite 8(SPA、モバイルファースト)
- テスト: Vitest 4 + Testing Library(jsdom)
- リント: oxlint
- データ保存: ブラウザの localStorage を想定(サーバ・DB なし)

## コマンド

すべて動作確認済み(2026-07-08)。

- 開発サーバ: `npm run dev`(`server.host: true` で LAN 公開。起動時表示の Network URL をスマホで開く)
- テスト: `npm test`(watch モードは `npm run test:watch`)
- ビルド: `npm run build`
- リント: `npm run lint`

## 開発の進め方

- 大きめの機能は `/spec` で要件 → 設計 → タスク分割してから実装する
- 実装は `/task` で docs/spec/tasks.md のタスク単位で進める
- 機能一式が実装できたら、リリース前に `/qa` で異常系・運用観点のチェックを通す
- 完了条件はテストが通ること + 動作確認済みであること。未確認のまま「完了」と報告しない
- セッションで得た知見・指摘は `/reflect` で本ファイルに反映する

## ルール

- 応答・コミットメッセージ・ドキュメントは日本語
- コミットは意味のある単位で小さく
- 秘密情報(.env、API キー)はコミットしない
- 設計(docs/spec/design.md)から外れる必要が出たら、勝手に進めず理由と代案を報告する
- 完全自動化より、人間の確認ポイントを挟んだ半自動を優先する
- 成果物を作って終わりにせず、次回から説明不要になる仕組み(スキル・テンプレ・チェックリスト)に還元する
- UI はスマホ(縦画面・タッチ操作)を第一に設計する。PC 表示は二の次で良い

## 知見メモ

- スマホから繋がらないとき: Windows ファイアウォールで Node.js の通信許可を確認。ネットワーク種別(Public/Private)が切り替わると許可がずれるので、繋がっていたのに急に不通になったらここを疑う
- PC の IP は DHCP で変わりうる。`npm run dev` 起動時に表示される Network の URL を正とする
- create-vite の最新テンプレートはリントが ESLint ではなく oxlint(設定は .oxlintrc.json)
- `crypto.randomUUID()` は HTTPS/localhost 限定。`http://IP` アクセスのスマホでは存在せず落ちるため、`crypto.getRandomValues` ベースの自前 ID 生成を使う(src/lib/id.ts)
- スマホの数字キーボード(`inputMode="numeric"`)はコロンが打てない。時刻入力は「2430」等のコロンなし桁も受け付ける
- localhost 開発では実機特有の問題(crypto・キーボード・http オリジン)が顕在化しない。機能一式が揃ったら必ず Android 実機で通し確認する
- localStorage はオリジン(IP:ポート)単位。PC の IP 変更や dev/preview のポート差でデータが別物になる(preview は 5173 に固定済み)
