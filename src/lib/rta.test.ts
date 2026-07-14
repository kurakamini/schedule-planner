import { describe, expect, it } from 'vitest'
import { buildSchedule } from './scheduler'
import { deltaClass, formatDelta, itemDelta, overallDelta } from './rta'
import type { PlanItem, ScenePlan } from '../types'

function item(over: Partial<PlanItem> & { id: string }): PlanItem {
  return {
    name: over.id,
    durationMin: 30,
    order: 0,
    included: true,
    done: false,
    ...over,
  }
}

function makePlan(
  items: PlanItem[],
  anchorAt: number,
  baselineEnds?: Record<string, number>,
): ScenePlan {
  return {
    dayKey: '2026-07-08',
    endAt: 1470,
    started: true,
    anchorAt,
    items,
    baselineEnds,
  }
}

function scheduleOf(plan: ScenePlan) {
  return buildSchedule({
    items: plan.items.filter((it) => it.included && !it.done),
    now: plan.anchorAt,
    endAt: plan.endAt,
  })
}

describe('formatDelta / deltaClass', () => {
  it('先行はマイナス緑、遅れはプラス赤、同着は ±0 グレー', () => {
    expect(formatDelta(-10)).toBe('-10分')
    expect(deltaClass(-10)).toBe('delta-ahead')
    expect(formatDelta(10)).toBe('+10分')
    expect(deltaClass(10)).toBe('delta-behind')
    expect(formatDelta(0)).toBe('±0分')
    expect(deltaClass(0)).toBe('delta-even')
  })

  it('60 分以上は時間表記になる', () => {
    expect(formatDelta(-140)).toBe('-2時間20分')
    expect(formatDelta(60)).toBe('+1時間')
  })
})

describe('overallDelta', () => {
  it('基準タイムがない(旧データ)場合は null', () => {
    const plan = makePlan([item({ id: 'a' })], 1270)
    expect(overallDelta(plan, scheduleOf(plan))).toBeNull()
  })

  it('早く完了して残りが前倒しになった分だけマイナスになる', () => {
    // 予定: a 21:10-21:40, b 21:40-22:10。a を 21:30 に完了 → b は 21:30-22:00
    const plan = makePlan(
      [item({ id: 'a', done: true, doneAt: 1290 }), item({ id: 'b', order: 1 })],
      1290,
      { a: 1300, b: 1330 },
    )
    expect(overallDelta(plan, scheduleOf(plan))).toBe(-10)
  })

  it('全タスク完了後は最後の完了時刻と基準の差になる', () => {
    const plan = makePlan(
      [
        item({ id: 'a', done: true, doneAt: 1290 }),
        item({ id: 'b', order: 1, done: true, doneAt: 1310 }),
      ],
      1310,
      { a: 1300, b: 1330 },
    )
    expect(overallDelta(plan, scheduleOf(plan))).toBe(-20)
  })

  it('タスクを外しても外しただけでは動かない(両側から除く)', () => {
    // 予定終了 22:10(b)だが b を外した → 基準も a の 21:40 で比べる
    const plan = makePlan(
      [item({ id: 'a' }), item({ id: 'b', order: 1, included: false })],
      1270,
      { a: 1300, b: 1330 },
    )
    expect(overallDelta(plan, scheduleOf(plan))).toBe(0)
  })

  it('実行中に追加したタスクの分は遅れとして現れる', () => {
    // 基準は a のみ(21:40 終了予定)。c(30 分)を追加 → 見込み 22:10
    const plan = makePlan(
      [item({ id: 'a' }), item({ id: 'c', order: 1 })],
      1270,
      { a: 1300 },
    )
    expect(overallDelta(plan, scheduleOf(plan))).toBe(30)
  })
})

describe('itemDelta', () => {
  const plan = makePlan(
    [
      item({ id: 'a', done: true, doneAt: 1295 }),
      item({ id: 'c', order: 1, done: true, doneAt: 1330 }),
    ],
    1330,
    { a: 1300 },
  )

  it('完了時刻 − 基準の予定終了を返す', () => {
    expect(itemDelta(plan, plan.items[0])).toBe(-5)
  })

  it('基準にないタスク(実行中の追加分)は null', () => {
    expect(itemDelta(plan, plan.items[1])).toBeNull()
  })
})
