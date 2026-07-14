import { describe, expect, it } from 'vitest'
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

describe('overallDelta(スプリット式: 最後の完了時点のズレ)', () => {
  it('基準タイムがない(旧データ)場合は null', () => {
    const plan = makePlan([item({ id: 'a' })], 1270)
    expect(overallDelta(plan)).toBeNull()
  })

  it('まだ何も完了していなければ ±0', () => {
    const plan = makePlan([item({ id: 'a' })], 1270, { a: 1300 })
    expect(overallDelta(plan)).toBe(0)
  })

  it('早く完了した瞬間にマイナスが出る(固定予定が後ろに控えていても)', () => {
    // a を予定 21:40 のところ 21:30 に完了。📌 b(24:00 固定)が残っていても
    // 終了見込みではなくスプリット差で測るのでマイナスが出る
    const plan = makePlan(
      [
        item({ id: 'a', done: true, doneAt: 1290 }),
        item({ id: 'b', order: 1, fixedStart: 1440 }),
      ],
      1290,
      { a: 1300, b: 1470 },
    )
    expect(overallDelta(plan)).toBe(-10)
  })

  it('遅れて完了するとプラスが出る', () => {
    const plan = makePlan(
      [item({ id: 'a', done: true, doneAt: 1310 }), item({ id: 'b', order: 1 })],
      1310,
      { a: 1300, b: 1330 },
    )
    expect(overallDelta(plan)).toBe(10)
  })

  it('直近(最後)の完了時点のズレを使う', () => {
    // a は -10 だったが、b の完了時点で +10 に転じた
    const plan = makePlan(
      [
        item({ id: 'a', done: true, doneAt: 1290 }),
        item({ id: 'b', order: 1, done: true, doneAt: 1340 }),
      ],
      1340,
      { a: 1300, b: 1330 },
    )
    expect(overallDelta(plan)).toBe(10)
  })

  it('基準のないタスク(実行中の追加分)の完了はスキップし、直近の基準あり完了で測る', () => {
    const plan = makePlan(
      [
        item({ id: 'a', done: true, doneAt: 1290 }),
        item({ id: 'c', order: 1, done: true, doneAt: 1400 }), // 基準なし
      ],
      1400,
      { a: 1300 },
    )
    expect(overallDelta(plan)).toBe(-10)
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
