// RTA タイマー風「予定比」表示の計算。
// 基準タイム(plan.baselineEnds = 開始時点の各タスクの予定終了)と実績を比べ、
// 早ければマイナス(緑)・遅れればプラス(赤)の分数を返す。
// 完了による再配置はタイムラインを現実に追従させるが、基準タイムは動かないので
// 「当初の予定に対して今どれだけズレているか」が測れる。

import type { PlanItem, ScenePlan } from '../types'
import type { ScheduleResult } from './scheduler'
import { formatDuration } from './time'

/**
 * 全体の予定比(分)。現在の終了見込み(全完了後は最後の完了時刻)と
 * 基準タイムの終了予定の差。基準がない(旧データ等)場合は null。
 * 外したタスクは両側から除くので、外しただけでは ± は動かない。
 */
export function overallDelta(
  plan: ScenePlan,
  schedule: ScheduleResult,
): number | null {
  const base = plan.baselineEnds
  if (!base) return null

  const included = plan.items.filter((it) => it.included)
  const baseEnds = included
    .map((it) => base[it.id])
    .filter((end): end is number => end !== undefined)
  if (baseEnds.length === 0) return null

  const doneAts = included
    .filter((it) => it.done)
    .map((it) => it.doneAt)
    .filter((at): at is number => at !== undefined)
  const currentFinish =
    schedule.scheduled.length > 0
      ? Math.max(...schedule.scheduled.map((s) => s.end))
      : doneAts.length > 0
        ? Math.max(...doneAts)
        : null
  if (currentFinish === null) return null

  return currentFinish - Math.max(...baseEnds)
}

/**
 * 完了タスク 1 件の予定比(分) = 完了時刻 − 基準タイムの予定終了。
 * 基準がない(実行中に追加したタスク等)場合は null
 */
export function itemDelta(plan: ScenePlan, item: PlanItem): number | null {
  const baseEnd = plan.baselineEnds?.[item.id]
  if (baseEnd === undefined || item.doneAt === undefined) return null
  return item.doneAt - baseEnd
}

/** 予定比を "-5分" / "+1時間5分" / "±0分" にする */
export function formatDelta(deltaMin: number): string {
  if (deltaMin === 0) return '±0分'
  return deltaMin > 0
    ? `+${formatDuration(deltaMin)}`
    : `-${formatDuration(-deltaMin)}`
}

/** 予定比の色分けクラス(緑=先行 / 赤=遅れ / グレー=同着) */
export function deltaClass(deltaMin: number): string {
  if (deltaMin === 0) return 'delta-even'
  return deltaMin > 0 ? 'delta-behind' : 'delta-ahead'
}
