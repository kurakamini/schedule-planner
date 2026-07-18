// スケジュール配置の純関数。docs/spec/design.md「スケジューラ」準拠。
// 時刻はすべて夜通算分(lib/time.ts 参照)。現在時刻は引数で受け取り、
// このモジュールは Date や localStorage に触れない。

import type { PlanItem } from '../types'

/** 1 項目の配置結果 */
export type Scheduled = { itemId: string; start: number; end: number }

/** 空き時間の区間 */
export type Gap = { start: number; end: number }

export type Warning =
  | { type: 'fixedOverlap'; itemIds: [string, string] } // 固定予定同士が重なっている
  | { type: 'fixedPast'; itemId: string } // 固定予定の開始時刻を現在時刻が過ぎている
  | { type: 'overEnd'; overrunMin: number } // 終了時刻に収まらない(超過分)

export type ScheduleResult = {
  /** 全項目の配置(超過分も含む)。開始時刻順 */
  scheduled: Scheduled[]
  /** 固定予定待ちの空き時間(タイムラインに「自由時間」行として表示) */
  gaps: Gap[]
  /** 最終タスク後〜終了の自由時間(分) */
  freeAfterMin: number
  /** gaps + freeAfterMin */
  freeTotalMin: number
  /** 終了時刻を越える項目(自動では削らない。外すのはユーザーの判断) */
  overflowItemIds: string[]
  warnings: Warning[]
}

/**
 * 今夜のスケジュールを組み立てる。
 *
 * - items には「included かつ未完了」の項目だけを渡すこと(呼び出し側の責務)
 * - 固定時刻タスクはユーザー指定の時刻を常に尊重する(過去でも動かさず警告のみ)
 * - 可変タスクは order 順を保ったまま、現在時刻から固定予定の隙間へ詰める。
 *   隙間に収まらない場合は固定予定の後ろへ送る(順序の入れ替えはしない)
 * - 並び順で固定タスクより後ろの可変タスクは、固定の前の隙間へ繰り上げない
 *   (並び順=実行順。固定の前にやりたいタスクは上に並べる)
 */
export function buildSchedule(input: {
  items: PlanItem[]
  now: number
  /** 終了時刻。undefined = 終了なし(超過警告・最終タスク後の自由時間を出さない) */
  endAt?: number
}): ScheduleResult {
  const { items, now, endAt } = input

  const fixed = items
    .filter((i) => i.fixedStart !== undefined)
    .sort((a, b) => a.fixedStart! - b.fixedStart! || a.order - b.order)

  const scheduled: Scheduled[] = []
  const warnings: Warning[] = []

  // 1. 固定時刻タスクを指定時刻どおりに配置
  for (const item of fixed) {
    scheduled.push({
      itemId: item.id,
      start: item.fixedStart!,
      end: item.fixedStart! + item.durationMin,
    })
    if (item.fixedStart! < now) {
      warnings.push({ type: 'fixedPast', itemId: item.id })
    }
  }

  // 固定予定同士の重なり検出(それまでの最遅終了と次の開始を比較)
  if (fixed.length > 1) {
    let latest = fixed[0]
    for (let i = 1; i < fixed.length; i++) {
      const latestEnd = latest.fixedStart! + latest.durationMin
      if (latestEnd > fixed[i].fixedStart!) {
        warnings.push({ type: 'fixedOverlap', itemIds: [latest.id, fixed[i].id] })
      }
      if (
        fixed[i].fixedStart! + fixed[i].durationMin >
        latest.fixedStart! + latest.durationMin
      ) {
        latest = fixed[i]
      }
    }
  }

  // 2. 可変タスクの配置を妨げる区間(固定予定の時間帯)を作る
  const blockers = mergeIntervals(
    fixed
      .map((i) => ({
        start: i.fixedStart!,
        end: i.fixedStart! + i.durationMin,
      }))
      .sort((a, b) => a.start - b.start),
  )

  // 3. 全項目を order 順にたどってカーソル配置する。
  //    固定項目を通過したらカーソルをその終了時刻まで進めるため、
  //    並び順で固定より後ろの可変タスクは固定の前へ繰り上がらない
  //    (画面の並び順=実行順。固定の前にやりたいタスクは上に並べる)。
  //    可変項目はカーソル以降で固定予定と重ならない最初の位置に置く
  const byOrder = [...items].sort((a, b) => a.order - b.order)
  let cursor = now
  for (const item of byOrder) {
    if (item.fixedStart !== undefined) {
      cursor = Math.max(cursor, item.fixedStart + item.durationMin)
      continue // 配置は手順 1 で済んでいる
    }
    let start = cursor
    for (const b of blockers) {
      if (b.end <= start) continue // 通過済みの固定予定
      if (start + item.durationMin <= b.start) break // 次の固定予定の前に収まる
      start = Math.max(start, b.end) // 収まらない → 固定予定の後ろへ(空きは自由時間になる)
    }
    scheduled.push({ itemId: item.id, start, end: start + item.durationMin })
    cursor = start + item.durationMin
  }

  scheduled.sort((a, b) => a.start - b.start)

  // 4. 空き時間 = [now, horizon] から配置済み区間を除いた残り。
  //    horizon は終了時刻。終了なしのときは最後のタスクの終了まで
  //    (「最終タスク後の自由時間」がなくなり、固定予定待ちの隙間だけ残る)
  const rawBusy = mergeIntervals(
    scheduled
      .map((s) => ({ start: Math.max(s.start, now), end: s.end }))
      .filter((b) => b.end > b.start)
      .sort((a, b) => a.start - b.start),
  )
  const horizon =
    endAt ?? (rawBusy.length > 0 ? rawBusy[rawBusy.length - 1].end : now)
  const busy = rawBusy
    .map((b) => ({ start: b.start, end: Math.min(b.end, horizon) }))
    .filter((b) => b.end > b.start)
  const free: Gap[] = []
  let c = now
  for (const b of busy) {
    if (b.start > c) free.push({ start: c, end: b.start })
    c = Math.max(c, b.end)
  }
  if (c < horizon) free.push({ start: c, end: horizon })

  // 末尾が終了時刻まで届く空きは「最終タスク後の自由時間」、それ以外は隙間
  let freeAfterMin = 0
  let gaps = free
  const lastFree = free[free.length - 1]
  if (endAt !== undefined && lastFree && lastFree.end === endAt) {
    freeAfterMin = lastFree.end - lastFree.start
    gaps = free.slice(0, -1)
  }
  const freeTotalMin = free.reduce((sum, g) => sum + (g.end - g.start), 0)

  // 5. 終了時刻を越える項目(終了なしのときは超過という概念がない)
  const overflowItemIds =
    endAt !== undefined
      ? scheduled.filter((s) => s.end > endAt).map((s) => s.itemId)
      : []
  if (endAt !== undefined && overflowItemIds.length > 0) {
    const maxEnd = Math.max(...scheduled.map((s) => s.end))
    warnings.push({ type: 'overEnd', overrunMin: maxEnd - endAt })
  }

  return { scheduled, gaps, freeAfterMin, freeTotalMin, overflowItemIds, warnings }
}

/** 開始時刻順に整列済みの区間リストを、重なりを統合して返す */
function mergeIntervals(sorted: Gap[]): Gap[] {
  const merged: Gap[] = []
  for (const cur of sorted) {
    const last = merged[merged.length - 1]
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end)
    } else {
      merged.push({ ...cur })
    }
  }
  return merged
}
