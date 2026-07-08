import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  formatNightTime,
  getNightKey,
  parseNightTime,
  toNightMinutes,
} from './time'

describe('parseNightTime', () => {
  it('通常の夜時刻をパースする', () => {
    expect(parseNightTime('21:05')).toBe(1265)
    expect(parseNightTime('22:00')).toBe(1320)
  })

  it('24 時以降の表記を受け付ける', () => {
    expect(parseNightTime('24:30')).toBe(1470)
    expect(parseNightTime('25:00')).toBe(1500)
    expect(parseNightTime('27:59')).toBe(1679)
  })

  it('0:00〜3:59 は翌日扱いに正規化する', () => {
    expect(parseNightTime('0:30')).toBe(1470)
    expect(parseNightTime('3:59')).toBe(1679)
  })

  it('4:00 は境界でそのまま扱う', () => {
    expect(parseNightTime('4:00')).toBe(240)
  })

  it('コロンなしの 3〜4 桁を受け付ける(スマホの数字キーボード対応)', () => {
    expect(parseNightTime('2430')).toBe(1470)
    expect(parseNightTime('2130')).toBe(1290)
    expect(parseNightTime('930')).toBe(570) // 9:30
    expect(parseNightTime('030')).toBe(1470) // 0:30 → 24:30 扱い
    expect(parseNightTime('２４３０')).toBe(1470)
  })

  it('コロンなしでも不正な値は null', () => {
    expect(parseNightTime('2860')).toBeNull() // 28 時
    expect(parseNightTime('2199')).toBeNull() // 99 分
    expect(parseNightTime('12345')).toBeNull()
    expect(parseNightTime('99')).toBeNull() // 桁不足
  })

  it('前後の空白と全角文字を許容する', () => {
    expect(parseNightTime(' 24:30 ')).toBe(1470)
    expect(parseNightTime('２４：３０')).toBe(1470) // 全角数字+全角コロン
    expect(parseNightTime('２４:３０')).toBe(1470) // 全角数字+半角コロン
  })

  it('不正な入力は null を返す', () => {
    expect(parseNightTime('')).toBeNull()
    expect(parseNightTime('abc')).toBeNull()
    expect(parseNightTime('24')).toBeNull()
    expect(parseNightTime('24:')).toBeNull()
    expect(parseNightTime(':30')).toBeNull()
    expect(parseNightTime('28:00')).toBeNull()
    expect(parseNightTime('24:60')).toBeNull()
    expect(parseNightTime('-1:30')).toBeNull()
  })
})

describe('formatNightTime', () => {
  it('夜通算分を HH:MM 形式にする', () => {
    expect(formatNightTime(1265)).toBe('21:05')
    expect(formatNightTime(1470)).toBe('24:30')
    expect(formatNightTime(1500)).toBe('25:00')
  })
})

describe('toNightMinutes', () => {
  it('夜の時刻はそのまま通算分にする', () => {
    expect(toNightMinutes(new Date(2026, 6, 8, 21, 13))).toBe(1273)
  })

  it('0:00〜3:59 は前夜の続きとして +1440 する', () => {
    expect(toNightMinutes(new Date(2026, 6, 9, 0, 30))).toBe(1470)
    expect(toNightMinutes(new Date(2026, 6, 9, 3, 59))).toBe(1679)
  })

  it('4:00 は新しい日の扱い(境界)', () => {
    expect(toNightMinutes(new Date(2026, 6, 9, 4, 0))).toBe(240)
  })
})

describe('getNightKey', () => {
  it('夜のうちは当日の日付', () => {
    expect(getNightKey(new Date(2026, 6, 8, 21, 13))).toBe('2026-07-08')
  })

  it('深夜 0 時を過ぎても同じ夜として扱う(3:59 まで)', () => {
    expect(getNightKey(new Date(2026, 6, 9, 1, 0))).toBe('2026-07-08')
    expect(getNightKey(new Date(2026, 6, 9, 3, 59))).toBe('2026-07-08')
  })

  it('朝 4:00 から新しい夜になる', () => {
    expect(getNightKey(new Date(2026, 6, 9, 4, 0))).toBe('2026-07-09')
  })

  it('月・日はゼロ埋めされる', () => {
    expect(getNightKey(new Date(2026, 0, 5, 21, 0))).toBe('2026-01-05')
  })
})

describe('formatDuration', () => {
  it('時間と分の表示を組み立てる', () => {
    expect(formatDuration(0)).toBe('0分')
    expect(formatDuration(45)).toBe('45分')
    expect(formatDuration(60)).toBe('1時間')
    expect(formatDuration(80)).toBe('1時間20分')
    expect(formatDuration(120)).toBe('2時間')
  })
})
