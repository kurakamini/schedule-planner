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
 */
export function buildSchedule(input: {
  items: PlanItem[]
  now: number
  endAt: number
}): ScheduleResult {
  const { items, now, endAt } = input

  const fixed = items
    .filter((i) => i.fixedStart !== undefined)
    .sort((a, b) => a.fixedStart! - b.fixedStart! || a.order - b.order)
  const flex = items
    .filter((i) => i.fixedStart === undefined)
    .sort((a, b) => a.order - b.order)

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

  // 2. 可変タスクの配置を妨げる区間(現在時刻以降に残っている固定予定)を作る
  const blockers: Gap[] = []
  for (const item of fixed) {
    const start = Math.max(item.fixedStart!, now)
    const end = item.fixedStart! + item.durationMin
    if (end > start) blockers.push({ start, end })
  }
  blockers.sort((a, b) => a.start - b.start)
  const mergedBlockers = mergeIntervals(blockers)

  // 3. 可変タスクを order 順にカーソル配置
  let cursor = now
  let bi = 0
  for (const item of flex) {
    for (;;) {
      // カーソルより手前・カーソルを含むブロッカーを消化する
      while (bi < mergedBlockers.length && mergedBlockers[bi].start <= cursor) {
        if (cursor < mergedBlockers[bi].end) cursor = mergedBlockers[bi].end
        bi++
      }
      const next = bi < mergedBlockers.length ? mergedBlockers[bi] : undefined
      if (next && cursor + item.durationMin > next.start) {
        // 次の固定予定までに収まらない → 固定予定の後ろへ送る(空きは自由時間になる)
        cursor = next.end
        bi++
        continue
      }
      scheduled.push({
        itemId: item.id,
        start: cursor,
        end: cursor + item.durationMin,
      })
      cursor += item.durationMin
      break
    }
  }

  scheduled.sort((a, b) => a.start - b.start)

  // 4. 空き時間 = [now, endAt] から配置済み区間を除いた残り
  const busy = mergeIntervals(
    scheduled
      .map((s) => ({ start: Math.max(s.start, now), end: Math.min(s.end, endAt) }))
      .filter((b) => b.end > b.start)
      .sort((a, b) => a.start - b.start),
  )
  const free: Gap[] = []
  let c = now
  for (const b of busy) {
    if (b.start > c) free.push({ start: c, end: b.start })
    c = Math.max(c, b.end)
  }
  if (c < endAt) free.push({ start: c, end: endAt })

  // 末尾が終了時刻まで届く空きは「最終タスク後の自由時間」、それ以外は隙間
  let freeAfterMin = 0
  let gaps = free
  const lastFree = free[free.length - 1]
  if (lastFree && lastFree.end === endAt) {
    freeAfterMin = lastFree.end - lastFree.start
    gaps = free.slice(0, -1)
  }
  const freeTotalMin = free.reduce((sum, g) => sum + (g.end - g.start), 0)

  // 5. 終了時刻を越える項目
  const overflowItemIds = scheduled
    .filter((s) => s.end > endAt)
    .map((s) => s.itemId)
  if (overflowItemIds.length > 0) {
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
