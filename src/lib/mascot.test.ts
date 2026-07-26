import { describe, expect, it } from 'vitest'
import type { Rule, RuleTrigger } from '../types'
import type { MascotState } from './mascot'
import { pickMascotLine } from './mascot'

// 21:10(1270) 時点・終了 24:30(1470) の想定
const base = { dayKey: '2026-07-08', sceneName: '夜', now: 1270, untilEnd: 200 }
const task = { taskId: 'i1', taskName: '風呂' }

const rule = (trigger: RuleTrigger, action: string, order = 0): Rule => ({
  id: `r${order}`,
  trigger,
  action,
  order,
})

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

  describe('if-then ルール(きめごと)', () => {
    it('自由時間に入ったら action を言い換えずそのまま言う', () => {
      const line = pickMascotLine(
        { ...base, ...task, kind: 'waiting', startAt: 1320, waitMin: 25 },
        [rule({ type: 'FREE_TIME' }, '10分タイマーをかけてから開く')],
      )
      expect(line.text).toBe('10分タイマーをかけてから開く')
      expect(line.ruleId).toBe('r0')
      expect(line.mood).toBe('rest') // 表情はルールではなく状況で決まる
    })

    it('TASK_START はタスク名が一致するときだけ出る', () => {
      const rules = [
        rule({ type: 'TASK_START', taskName: '英語' }, 'まず教材を開く'),
      ]
      expect(
        pickMascotLine({ ...base, ...task, kind: 'now', leftMin: 30 }, rules)
          .ruleId,
      ).toBeUndefined()
      expect(
        pickMascotLine(
          { ...base, taskId: 'i2', taskName: '英語', kind: 'now', leftMin: 30 },
          rules,
        ).text,
      ).toBe('まず教材を開く')
    })

    it('ALL_DONE は全部終わったときに出る', () => {
      const rules = [rule({ type: 'ALL_DONE' }, '何を見るか先に決めてから開く')]
      expect(pickMascotLine({ ...base, kind: 'allDone' }, rules).text).toBe(
        '何を見るか先に決めてから開く',
      )
    })

    it('TIME はその時刻を過ぎてから出る', () => {
      const rules = [rule({ type: 'TIME', at: 1350 }, '1本を見終えて終了する')] // 22:30
      expect(
        pickMascotLine({ ...base, now: 1320, kind: 'allDone' }, rules).ruleId,
      ).toBeUndefined()
      expect(
        pickMascotLine({ ...base, now: 1360, kind: 'allDone' }, rules).text,
      ).toBe('1本を見終えて終了する')
    })

    it('常時掲示になる TIME より、その瞬間の状況ルールを優先する', () => {
      const rules = [
        rule({ type: 'TIME', at: 1000 }, '時刻ルール', 0),
        rule({ type: 'ALL_DONE' }, '状況ルール', 1),
      ]
      expect(pickMascotLine({ ...base, kind: 'allDone' }, rules).text).toBe(
        '状況ルール',
      )
    })

    it('過ぎた TIME が複数あれば直近の時刻のものを出す', () => {
      const rules = [
        rule({ type: 'TIME', at: 1200 }, '古いほう', 0),
        rule({ type: 'TIME', at: 1300 }, '直近のほう', 1),
      ]
      expect(
        pickMascotLine({ ...base, now: 1400, kind: 'allDone' }, rules).text,
      ).toBe('直近のほう')
    })

    it('同じ状況に複数当てはまるなら order の若いほうを出す', () => {
      const rules = [
        rule({ type: 'ALL_DONE' }, '先に登録したほう', 0),
        rule({ type: 'ALL_DONE' }, 'あとに登録したほう', 1),
      ]
      expect(pickMascotLine({ ...base, kind: 'allDone' }, rules).text).toBe(
        '先に登録したほう',
      )
    })

    it('当てはまるルールがなければ通常のセリフに戻る', () => {
      const line = pickMascotLine(
        { ...base, ...task, kind: 'now', leftMin: 30 },
        [rule({ type: 'ALL_DONE' }, '出てはいけないほう')],
      )
      expect(line.ruleId).toBeUndefined()
      expect(line.text).toContain('風呂')
    })
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
