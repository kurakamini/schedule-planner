# schedule-planner(スケジュール計画立案)

帰宅後にやることを登録すると、現在時刻をもとに「今夜のスケジュール」を自動で立てる個人用アプリ。
帰宅後の YouTube ダラ見による時間の浪費を減らすために作る。

- 完全ローカル運用(サーバ・DB なし)。データは端末のブラウザ内にのみ保存され、外部送信しない
- スマホ(Android)での利用が前提のモバイルファースト UI

## 使い方(スマホから)

1. PC でアプリを起動する

   ```
   npm run dev
   ```

2. 起動時に表示される `Network: http://192.168.x.x:5173/` の URL を、同じ Wi-Fi に繋いだスマホのブラウザで開く

> スマホから繋がらない場合は、Windows ファイアウォールで Node.js の「プライベートネットワーク」通信が許可されているか確認する。
> PC の IP は変わることがあるため、起動時に表示される Network の URL を使う。

## 開発

| コマンド             | 内容                                   |
| -------------------- | -------------------------------------- |
| `npm run dev`        | 開発サーバ起動(LAN 公開、ポート 5173) |
| `npm test`           | テスト実行(Vitest)                   |
| `npm run test:watch` | テストの watch 実行                    |
| `npm run build`      | 型チェック + 本番ビルド                |
| `npm run lint`       | リント(oxlint)                       |

## 技術スタック

- React 19 + TypeScript + Vite 8
- Vitest 4 + Testing Library(テスト)/ oxlint(リント)

## 開発フロー(Claude Code)

```
/kickoff(済)→ /spec 機能名 → /task(繰り返し)→ /qa → /reflect
```

仕様・設計・タスクは `docs/spec/` 配下に置く。詳細なルールは [CLAUDE.md](CLAUDE.md) を参照。
