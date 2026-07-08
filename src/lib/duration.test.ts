import { describe, expect, it } from 'vitest'
import { parseDurationMin } from './duration'

describe('parseDurationMin', () => {
  it('半角の整数をパースする', () => {
    expect(parseDurationMin('30')).toBe(30)
    expect(parseDurationMin('1')).toBe(1)
    expect(parseDurationMin('999')).toBe(999)
    expect(parseDurationMin(' 45 ')).toBe(45)
  })

  it('全角数字も受け付ける(時刻入力と挙動を揃える)', () => {
    expect(parseDurationMin('３０')).toBe(30)
    expect(parseDurationMin('１２０')).toBe(120)
  })

  it('0・空・非数値・4 桁以上は null', () => {
    expect(parseDurationMin('0')).toBeNull()
    expect(parseDurationMin('')).toBeNull()
    expect(parseDurationMin('abc')).toBeNull()
    expect(parseDurationMin('1000')).toBeNull()
    expect(parseDurationMin('3.5')).toBeNull()
    expect(parseDurationMin('-5')).toBeNull()
  })
})
