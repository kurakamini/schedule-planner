import { describe, expect, it } from 'vitest'
import type { MascotState } from './mascot'
import { pickMascotLine } from './mascot'

const base = { dayKey: '2026-07-08', sceneName: '夜', untilEnd: 200 }
const task = { taskId: 'i1', taskName: '風呂' }

describe('pickMascotLine', () => {
  it('やることがないときは編集をうながす', () => {
    const line = pickMascotLine({ ...base, kind: 'empty' })
    expect(line.mood).toBe('idle')
    expect(line.text).toContain('プランを編集')
  })

  it('いまやるタスクがあるときはタスク名と残り時間で応援する', () => {
    const line = pickMascotLine({ ...base, ...task, kind: 'now', leftMin: 30 })
    expect(line.mood).toBe('go')
    expect(line.text).toContain('風呂')
    expect(line.text).toContain('30分')
  })

  it('残りわずかならラストスパートを煽る', () => {
    const line = pickMascotLine({ ...base, ...task, kind: 'now', leftMin: 5 })
    expect(line.mood).toBe('hurry')
    expect(line.text).toContain('風呂')
  })

  it('終了予定を過ぎていたら完了をうながす', () => {
    const line = pickMascotLine({ ...base, ...task, kind: 'now', leftMin: -10 })
    expect(line.mood).toBe('hurry')
    // 「あと -10分」のような壊れた表示にはしない
    expect(line.text).not.toContain('-')
  })

  it('固定予定待ちのときは休憩をすすめ、開始時刻を伝える', () => {
    const line = pickMascotLine({
      ...base,
      ...task,
      kind: 'waiting',
      startAt: 1320,
      waitMin: 10,
    })
    expect(line.mood).toBe('rest')
    expect(line.text).toContain('22:00')
    expect(line.text).toContain('10分')
  })

  it('全部終わったら残りの自由時間を伝えてほめる', () => {
    const line = pickMascotLine({ ...base, kind: 'allDone' })
    expect(line.mood).toBe('done')
    expect(line.text).toContain('3時間20分')
  })

  it('全部終わって終了時刻も過ぎていたらねぎらう', () => {
    const line = pickMascotLine({ ...base, kind: 'allDone', untilEnd: -5 })
    expect(line.mood).toBe('sleepy')
    expect(line.text).toContain('おつかれさま')
  })

  it('タスクが残っていても終了時刻を過ぎたら切り上げをすすめる', () => {
    const line = pickMascotLine({
      ...base,
      ...task,
      kind: 'now',
      leftMin: 20,
      untilEnd: 0,
    })
    expect(line.mood).toBe('sleepy')
  })

  describe('終了時刻なしのシーン(untilEnd = null)', () => {
    it('残り時間に触れずに応援する', () => {
      const line = pickMascotLine({
        ...base,
        ...task,
        untilEnd: null,
        kind: 'now',
        leftMin: 30,
      })
      expect(line.mood).toBe('go')
      expect(line.text).toContain('風呂')
    })

    it('全部終わったらシーン名を添えて完走をたたえる', () => {
      const line = pickMascotLine({
        ...base,
        sceneName: '休日',
        untilEnd: null,
        kind: 'allDone',
      })
      expect(line.mood).toBe('done')
      expect(line.text).toContain('休日')
      // 自由時間の残りは計算できないので出さない
      expect(line.text).not.toContain('分')
    })
  })

  it('同じ状況なら何度呼んでも同じセリフになる(再描画でぶれない)', () => {
    const state: MascotState = { ...base, ...task, kind: 'now', leftMin: 30 }
    const first = pickMascotLine(state).text
    for (let i = 0; i < 5; i++) {
      expect(pickMascotLine(state).text).toBe(first)
    }
  })

  it('タスクが変わればセリフの言い回しも変わる', () => {
    const texts = new Set(
      ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'].map(
        (taskId) =>
          pickMascotLine({
            ...base,
            taskId,
            taskName: 'X',
            kind: 'now',
            leftMin: 30,
          }).text,
      ),
    )
    expect(texts.size).toBeGreaterThan(1)
  })
})
