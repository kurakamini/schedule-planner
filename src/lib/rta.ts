// RTA タイマー風「予定比」表示の計算。
// 基準タイム(plan.baselineEnds = 開始時点の各タスクの予定終了)と実績を比べ、
// 早ければマイナス(緑)・遅れればプラス(赤)の分数を返す。
// 完了による再配置はタイムラインを現実に追従させるが、基準タイムは動かないので
// 「当初の予定に対して今どれだけズレているか」が測れる。

import type { PlanItem, ScenePlan } from '../types'
import { formatDuration } from './time'

/**
 * 全体の予定比(分)= 最後に完了したタスク時点のズレ(RTA のスプリット差)。
 * 早く完了した瞬間にマイナスが出て、固定予定待ちの自由時間には左右されない
 * (終了見込みベースだと固定予定に釘付けされ、遅れ=プラスしか出なかった)。
 * 収まるかどうかの見込みは「終了までに◯分収まりません」警告が別で担う。
 * 実行中に追加したタスク(基準なし)の完了はスプリットに数えず、直近の基準あり完了で測る。
 * まだ基準ありの完了がなければ ±0。基準タイム自体がない(旧データ等)場合は null
 */
export function overallDelta(plan: ScenePlan): number | null {
  const base = plan.baselineEnds
  if (!base) return null

  let last: PlanItem | undefined
  for (const it of plan.items) {
    if (!it.included || !it.done || it.doneAt === undefined) continue
    if (base[it.id] === undefined) continue
    if (last?.doneAt === undefined || it.doneAt >= last.doneAt) last = it
  }
  if (last === undefined) return 0
  return itemDelta(plan, last)
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
