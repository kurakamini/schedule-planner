# 引き継ぎ: schedule-planner に「実行意図」機構を組み込む

作成日: 2026-07-26 / 引き継ぎ元: Claude（チャット）→ Claude Code

## 1. 背景

平日の夜と週末に、YouTube を見ているうちに時間が過ぎてしまうのを何とかしたい、というのが出発点。
既に自作のスケジュールアプリがあるため、生活習慣の工夫ではなく **アプリ側の機能として仕組みを持たせる** 方向に切り替えた。

対象リポジトリ（GitHub Pages で公開中）:
https://kurakamini.github.io/schedule-planner/

## 2. 現時点で分かっていないこと

**チャット側ではアプリの中身を確認できていない。** 静的取得ではタイトル（`スケジュール計画立案`）しか返らず、
JS でレンダリングしているものと推測される。Chrome 拡張も未接続だったため画面も未確認。

したがって以下は **すべて未確認** で、Claude Code 側で最初に把握すべき項目:

- フレームワーク / ビルド構成（素の HTML+JS か、Vite + React などか）
- 既存のデータモデル（イベントをどう保持しているか、永続化は localStorage か IndexedDB か）
- 通知の実装有無（Notification API / Service Worker / PWA 化しているか）
- PWA かどうか（manifest.json、Service Worker の有無）

## 3. 設計方針（根拠つき）

### 方針A: 使用時間ダッシュボードは作らない

デジタル自制介入の系統的レビュー（Biedermann et al., 2021, *Journal of Computer Assisted Learning*）では、
**利用状況の可視化だけに頼る介入は、気晴らしの利用量を減らせなかった** と報告されている。
グラフを作ると達成感はあるが行動は変わらないので、優先度は最下位。
記録するとしても「予約枠を守れたか」の boolean のみに留める。

### 方針B: if-then（実行意図）を一級市民にする

Gollwitzer & Sheeran (2006) の94研究メタ分析で、
「もし X なら Y する」形式の if-then プランは目標達成に中〜大の効果（d ≈ 0.65）が確認されている。
通常の `Event { start, end, title }` に加えて、**トリガーと行動をペアで保持する Rule** を独立したエンティティにする。

重要: 通知文に action をそのまま出す。
「20:00 集中枠です」ではなく「ソファに座ったら、まず机で15分」と出す。
時刻アラームに退化させると効果が消える。

### 方針C: 事前コミットメント（変更に摩擦を作る）

同レビューは、**逸脱へのペナルティが数クリックで無視できる仕組みは機能しない** とも結論づけている。
逆に言えば、少し面倒にするだけで効く。自作アプリで一番差がつくのはここ。

実装案:
- 前夜に翌日の枠を確定 → `lockedAt` を打つ
- ロック後の編集には摩擦を入れる（10秒の待機、変更理由を1行必須、など）

### 方針D: 記録するのは「着手」だけ

`completed` フラグは持たない。達成できなかった日のログが自己否定の材料になるため。
ボタンは「はじめる」1つでよい。

## 4. データモデル案（たたき台）

```
Slot {
  id
  kind: "FOCUS" | "ALLOWED"   // 集中枠 / 見ていい枠
  start, end
  lockedAt?: timestamp        // これ以降は編集にコストをかける
}

Rule {
  id
  trigger: { type: "TIME" | "GEOFENCE" | "APP_LAUNCH" | "EVENT_END", value }
  action: string              // 動詞で始まる一文。通知文にそのまま使う
  slotId?: string
}

Log {
  slotId
  started: boolean            // 完了ではなく着手のみ
  date
}
```

「禁止」ではなく **「見ていい時間を予約する」** という設計にしている点が肝。
`kind: "ALLOWED"` の枠を明示的に確保することで反動を防ぐ。

## 5. 初期の時間割テンプレ（デフォルト値の参考）

平日:
- 20:00–20:45 FOCUS
- 20:45–22:30 ALLOWED
- 22:30 終了

週末:
- 午前は外の予定を先に入れる
- 午後に1枠 FOCUS
- 夕方以降は ALLOWED（制限なし）

if-then の初期セット:
- 帰宅してソファに座ったら → 先に机で15分だけ手を動かす
- 「1本だけ」と思ったら → 10分タイマーをかけてから開く
- 関連動画に指が伸びたら → 一度立って水を飲みに行く
- 22:30 の通知が出たら → その1本を見終えて終了

## 6. OS 連携について（スコープ外に置く判断）

実際にアプリの起動をブロックするところまで踏み込むなら、iOS は Screen Time API 系の3フレームワーク構成になる:

- `FamilyControls` — 認可とアプリ選択UI（`FamilyActivityPicker`）
- `ManagedSettings` — 実際のシールド適用
- `DeviceActivity` — スケジュールによる有効化/無効化

ただし制約が大きい:
- 利用には Apple からの特別な権限付与が事前に必要
- プライバシー保護のため、ユーザーが選んだアプリは不透明なトークンとしてしか見えない
- Screen Time 設定をパスコードでロックしても、サードパーティアプリへの権限自体は簡単に外せる（既知の弱点）

**結論: 初版ではブロックは OS 標準機能に任せる。** アプリ側は「枠の予約」「if-then 通知」「着手ログ」の3つに絞る。

## 7. 次にやること

1. リポジトリの現状把握（構成・データモデル・永続化・通知の有無）
2. `Slot` / `Rule` / `Log` を既存モデルにどう足すか、差分方針を決める
3. `Rule` の CRUD と、action をそのまま出す通知文の生成
4. `lockedAt` と、ロック後編集の摩擦（まずは確認ダイアログ＋理由入力から）
5. 「はじめる」ボタンと `Log.started` の記録
6. 余力があれば PWA 化して通知の信頼性を上げる

## 8. Claude Code での最初のプロンプト例

```
このリポジトリは自作のスケジュールアプリです。
docs/handover-schedule-planner.md を読んでから、まず現状の構成
（フレームワーク、データモデル、永続化方法、通知実装の有無）を
調べて報告してください。実装はまだ始めないでください。
```

## 9. 参照

- Biedermann et al. (2021) Digital self-control interventions for distracting media multitasking — A systematic review. https://onlinelibrary.wiley.com/doi/10.1111/jcal.12581
- Gollwitzer & Sheeran (2006) Implementation Intentions and Goal Achievement: A Meta-analysis of Effects and Processes.
- Apple, Meet the Screen Time API (WWDC21) https://developer.apple.com/videos/play/wwdc2021/10123/
- Apple, What's new in Screen Time API (WWDC22) https://developer.apple.com/videos/play/wwdc2022/110336/
