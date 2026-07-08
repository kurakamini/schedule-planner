import { describe, expect, it } from 'vitest'
import type { PlanItem } from '../types'
import { buildSchedule } from './scheduler'
import { parseNightTime } from './time'

/** "21:10" → 夜通算分(テストの読みやすさ用) */
const t = (s: string) => parseNightTime(s)!

function flex(id: string, durationMin: number, order: number): PlanItem {
  return { id, name: id, durationMin, order, included: true, done: false }
}

function fixedItem(
  id: string,
  start: string,
  durationMin: number,
  order: number,
): PlanItem {
  return { ...flex(id, durationMin, order), fixedStart: t(start) }
}

describe('buildSchedule', () => {
  it('requirements.md の具体例を再現する(21:10 帰宅・就寝 24:30)', () => {
    const result = buildSchedule({
      items: [
        flex('夕食', 30, 0),
        flex('風呂', 30, 1),
        flex('英語', 30, 2),
        fixedItem('配信', '22:00', 30, 3),
      ],
      now: t('21:10'),
      bedtime: t('24:30'),
    })

    expect(result.scheduled).toEqual([
      { itemId: '夕食', start: t('21:10'), end: t('21:40') },
      { itemId: '配信', start: t('22:00'), end: t('22:30') },
      { itemId: '風呂', start: t('22:30'), end: t('23:00') },
      { itemId: '英語', start: t('23:00'), end: t('23:30') },
    ])
    // 風呂 30 分は 21:40〜22:00 の隙間 20 分に収まらない → 空きは自由時間扱い
    expect(result.gaps).toEqual([{ start: t('21:40'), end: t('22:00') }])
    expect(result.freeAfterMin).toBe(60)
    expect(result.freeTotalMin).toBe(80)
    expect(result.overflowItemIds).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('固定なしなら現在時刻から順に積む', () => {
    const result = buildSchedule({
      items: [flex('a', 30, 0), flex('b', 45, 1)],
      now: t('21:10'),
      bedtime: t('24:30'),
    })

    expect(result.scheduled).toEqual([
      { itemId: 'a', start: t('21:10'), end: t('21:40') },
      { itemId: 'b', start: t('21:40'), end: t('22:25') },
    ])
    expect(result.gaps).toEqual([])
    expect(result.freeAfterMin).toBe(125)
    expect(result.freeTotalMin).toBe(125)
  })

  it('空リストなら全部が自由時間', () => {
    const result = buildSchedule({ items: [], now: t('21:10'), bedtime: t('24:30') })

    expect(result.scheduled).toEqual([])
    expect(result.gaps).toEqual([])
    expect(result.freeAfterMin).toBe(200)
    expect(result.freeTotalMin).toBe(200)
    expect(result.warnings).toEqual([])
  })

  it('就寝時刻を過ぎていたら自由時間は 0(負にならない)', () => {
    const result = buildSchedule({ items: [], now: t('25:00'), bedtime: t('24:30') })

    expect(result.freeAfterMin).toBe(0)
    expect(result.freeTotalMin).toBe(0)
  })

  it('収まらない項目は超過リストに入り、警告が出る(自動では削らない)', () => {
    const result = buildSchedule({
      items: [flex('a', 30, 0), flex('b', 30, 1)],
      now: t('24:10'),
      bedtime: t('24:30'),
    })

    // 配置自体はされる(a は 24:10〜24:40、b は 24:40〜25:10)
    expect(result.scheduled).toEqual([
      { itemId: 'a', start: t('24:10'), end: t('24:40') },
      { itemId: 'b', start: t('24:40'), end: t('25:10') },
    ])
    expect(result.overflowItemIds).toEqual(['a', 'b'])
    expect(result.warnings).toEqual([{ type: 'overBedtime', overrunMin: 40 }])
    expect(result.freeTotalMin).toBe(0)
  })

  it('開始時刻を過ぎた固定予定は時刻どおり残し、警告を出す', () => {
    const result = buildSchedule({
      items: [fixedItem('配信', '22:00', 30, 0), flex('a', 30, 1)],
      now: t('23:20'),
      bedtime: t('24:30'),
    })

    // 固定は動かさない。過去の固定は可変タスクの配置を妨げない
    expect(result.scheduled).toEqual([
      { itemId: '配信', start: t('22:00'), end: t('22:30') },
      { itemId: 'a', start: t('23:20'), end: t('23:50') },
    ])
    expect(result.warnings).toEqual([{ type: 'fixedPast', itemId: '配信' }])
    expect(result.freeAfterMin).toBe(40)
  })

  it('固定予定同士の重なりを警告する', () => {
    const result = buildSchedule({
      items: [fixedItem('A', '22:00', 40, 0), fixedItem('B', '22:30', 30, 1)],
      now: t('21:00'),
      bedtime: t('24:30'),
    })

    expect(result.warnings).toEqual([
      { type: 'fixedOverlap', itemIds: ['A', 'B'] },
    ])
    // 配置はどちらも指定時刻どおり
    expect(result.scheduled).toEqual([
      { itemId: 'A', start: t('22:00'), end: t('22:40') },
      { itemId: 'B', start: t('22:30'), end: t('23:00') },
    ])
  })

  it('複数の固定予定をまたいで後ろへ送る', () => {
    const result = buildSchedule({
      items: [
        fixedItem('f1', '21:30', 30, 0),
        fixedItem('f2', '22:10', 30, 1),
        flex('a', 30, 2),
      ],
      now: t('21:10'),
      bedtime: t('24:30'),
    })

    // a(30 分)は 21:10〜21:30(20 分)にも 22:00〜22:10(10 分)にも収まらない
    expect(result.scheduled).toEqual([
      { itemId: 'f1', start: t('21:30'), end: t('22:00') },
      { itemId: 'f2', start: t('22:10'), end: t('22:40') },
      { itemId: 'a', start: t('22:40'), end: t('23:10') },
    ])
    expect(result.gaps).toEqual([
      { start: t('21:10'), end: t('21:30') },
      { start: t('22:00'), end: t('22:10') },
    ])
    expect(result.freeAfterMin).toBe(80)
    expect(result.freeTotalMin).toBe(30 + 80)
  })

  it('可変タスクがなくても固定予定前後の空きを算出する', () => {
    const result = buildSchedule({
      items: [fixedItem('配信', '22:00', 30, 0)],
      now: t('21:00'),
      bedtime: t('24:30'),
    })

    expect(result.gaps).toEqual([{ start: t('21:00'), end: t('22:00') }])
    expect(result.freeAfterMin).toBe(120)
    expect(result.freeTotalMin).toBe(180)
  })

  it('境界: 隙間・就寝時刻にぴったり収まる場合は超過も隙間もなし', () => {
    const result = buildSchedule({
      items: [
        flex('a', 50, 0), // 21:10〜22:00 ちょうどで固定予定に接続
        fixedItem('f', '22:00', 30, 1),
        flex('b', 120, 2), // 22:30〜24:30 ちょうどで就寝
      ],
      now: t('21:10'),
      bedtime: t('24:30'),
    })

    expect(result.scheduled).toEqual([
      { itemId: 'a', start: t('21:10'), end: t('22:00') },
      { itemId: 'f', start: t('22:00'), end: t('22:30') },
      { itemId: 'b', start: t('22:30'), end: t('24:30') },
    ])
    expect(result.gaps).toEqual([])
    expect(result.freeAfterMin).toBe(0)
    expect(result.freeTotalMin).toBe(0)
    expect(result.overflowItemIds).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('order がばらばらでも可変タスクは order 順に配置する', () => {
    const result = buildSchedule({
      items: [flex('c', 10, 5), flex('a', 10, 1), flex('b', 10, 3)],
      now: t('21:00'),
      bedtime: t('24:30'),
    })

    expect(result.scheduled.map((s) => s.itemId)).toEqual(['a', 'b', 'c'])
  })
})
