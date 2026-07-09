# schedule-planner(スケジュール計画立案)

帰宅後にやることを登録すると、現在時刻をもとに「今夜のスケジュール」を自動で立てる個人用アプリ。
帰宅後の YouTube ダラ見による時間の浪費を減らすために作る。

- GitHub Pages で公開: **https://kurakamini.github.io/schedule-planner/**
- データは端末のブラウザ内にのみ保存され、外部送信しない(サーバ・DB なし)
- スマホ(Android)での利用が前提のモバイルファースト UI

## 使い方(スマホから)

1. スマホの Chrome で **https://kurakamini.github.io/schedule-planner/** を開く
2. メニュー(⋮) → **「ホーム画面に追加」** でアイコンから一発起動できる

PC もローカルサーバも不要。いつでも使える。

## 運用上の注意(データを失わないために)

- データは端末のブラウザ内(localStorage)にのみ保存される。**同じスマホの同じブラウザ**で開く限り残る
- **ブラウザの「閲覧データ削除」でデータが消える**: Chrome の「Cookie とサイトデータ」を削除すると初期化されるので注意
- 公開 URL は固定なので、以前のように接続先(IP)が変わってデータが見えなくなることはない

## 開発

| コマンド             | 内容                                   |
| -------------------- | -------------------------------------- |
| `npm run dev`        | 開発サーバ起動(LAN 公開、ポート 5173) |
| `npm test`           | テスト実行(Vitest)                   |
| `npm run test:watch` | テストの watch 実行                    |
| `npm run build`      | 型チェック + 本番ビルド                |
| `npm run lint`       | リント(oxlint)                       |

`main` に push すると GitHub Actions(`.github/workflows/deploy.yml`)が build → GitHub Pages へ自動デプロイする(1〜2 分で反映)。

## 技術スタック

- React 19 + TypeScript + Vite 8
- Vitest 4 + Testing Library(テスト)/ oxlint(リント)

## 開発フロー(Claude Code)

```
/kickoff(済)→ /spec 機能名 → /task(繰り返し)→ /qa → /reflect
```

仕様・設計・タスクは `docs/spec/` 配下に置く。詳細なルールは [CLAUDE.md](CLAUDE.md) を参照。
