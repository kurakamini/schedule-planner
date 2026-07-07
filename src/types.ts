// データモデル: docs/spec/design.md「データモデル」準拠
// 時刻はすべて「夜通算分」(その夜の基準日 0:00 からの分数。24:30 → 1470)で持つ

/** ルーチンタスク(マスタ) */
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

/** 今夜のプランの 1 項目 */
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

/** 今夜のプラン全体 */
export type TonightPlan = {
  /** 夜の識別子(例 "2026-07-08")。起動時に不一致なら破棄する(F5) */
  nightKey: string
  /** 今夜の就寝時刻(夜通算分) */
  bedtime: number
  /** false=プラン作成ビュー / true=実行ビュー */
  started: boolean
  items: PlanItem[]
}

export type Settings = {
  /** デフォルト就寝時刻(夜通算分)。初期値 1470(24:30) */
  defaultBedtime: number
}
