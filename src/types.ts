// データモデル: docs/spec/design.md「データモデル」準拠
// 時刻はすべて「夜通算分」(その夜の基準日 0:00 からの分数。24:30 → 1470)で持つ

/** シーン(夜・朝・休日など、スケジュールを立てる時間帯の区分) */
export type Scene = {
  id: string
  /** 例: 夜、朝、休日 */
  name: string
  /**
   * デフォルト終了時刻(夜通算分)。夜なら就寝、朝なら出発に相当。
   * undefined = 終了なし(締切を決めず所要時間だけで組むシーン。休日の家事など)
   */
  defaultEnd?: number
  /** セレクタの表示順 */
  order: number
}

/** ルーチンタスク(マスタ。シーンごとに別リスト) */
export type RoutineTask = {
  id: string
  name: string
  /** 所要時間(分) */
  durationMin: number
  /** 固定開始時刻(夜通算分)。なければ可変タスク */
  fixedStart?: number
  /** 表示順 */
  order: number
}

/** 当日プランの 1 項目 */
export type PlanItem = {
  id: string
  /** ルーチン由来なら元 ID(当日追加は undefined) */
  routineId?: string
  name: string
  durationMin: number
  fixedStart?: number
  order: number
  /** 今日やるか。外す=false(行は残すので戻せる) */
  included: boolean
  done: boolean
  /** 完了時刻(夜通算分) */
  doneAt?: number
}

/**
 * if-then ルール(実行意図)の引き金。
 * docs/handover-schedule-planner.md では位置情報・アプリ起動も挙げているが、
 * ブラウザからは検知できないため、アプリが自分で判定できるものだけを持つ
 */
export type RuleTrigger =
  /** 固定予定待ちなどの自由時間に入ったとき(動画に手が伸びる瞬間) */
  | { type: 'FREE_TIME' }
  /** その日のタスクを全部終えたとき */
  | { type: 'ALL_DONE' }
  /** 名前が一致するタスクを始めるとき */
  | { type: 'TASK_START'; taskName: string }
  /** 指定時刻(夜通算分)を過ぎたとき。常時掲示になるので優先度は最後 */
  | { type: 'TIME'; at: number }

/**
 * 「もし X なら Y する」1 件。シーンをまたいで共通(「1 本だけと思ったら」等は
 * 時間帯に依らないため)。action は言い換えずそのまま提示する
 */
export type Rule = {
  id: string
  trigger: RuleTrigger
  /** 動詞で始まる一文。ミニキャラがこのまま読み上げる */
  action: string
  /** 表示順。当てはまるルールが複数あれば若い順に 1 件だけ出す */
  order: number
}

/** 当日のプラン全体(シーンごとに 1 つ) */
export type ScenePlan = {
  /** 日の識別子(例 "2026-07-08"、朝 4 時境界)。起動時に不一致なら破棄する(F5) */
  dayKey: string
  /** 当日の終了時刻(夜通算分)。undefined = 終了なし(所要時間だけで組む) */
  endAt?: number
  /** false=プラン作成ビュー / true=実行ビュー */
  started: boolean
  /**
   * スケジュールの起点(夜通算分)。プラン開始・完了チェックなど
   * 「先頭タスクが変わる操作」の時刻で、時間経過や開き直しでは動かさない。
   * これにより開始時刻がリロードでずれない
   */
  anchorAt: number
  items: PlanItem[]
  /**
   * RTA 風「予定比」表示の基準タイム: itemId → 予定終了時刻(夜通算分)。
   * スケジュール開始時に凍結する(完了による再配置では動かさない)。
   * この機能より前に開始したプランには存在しないので optional
   */
  baselineEnds?: Record<string, number>
}
