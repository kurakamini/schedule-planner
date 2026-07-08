import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutineTask, TonightPlan } from '../types'
import {
  DEFAULT_SETTINGS,
  clearAllData,
  clearTonightPlan,
  loadRoutines,
  loadSettings,
  loadTonightPlan,
  saveRoutines,
  saveSettings,
  saveTonightPlan,
} from './storage'

const routine: RoutineTask = {
  id: 'r1',
  name: '夕食',
  durationMin: 30,
  order: 0,
}

const plan: TonightPlan = {
  nightKey: '2026-07-08',
  bedtime: 1470,
  started: true,
  items: [
    {
      id: 'i1',
      routineId: 'r1',
      name: '夕食',
      durationMin: 30,
      order: 0,
      included: true,
      done: true,
      doneAt: 1300,
    },
    {
      id: 'i2',
      name: '配信',
      durationMin: 30,
      fixedStart: 1320,
      order: 1,
      included: true,
      done: false,
    },
  ],
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('settings', () => {
  it('保存した設定を読み戻せる', () => {
    saveSettings({ defaultBedtime: 1500 })
    expect(loadSettings()).toEqual({ defaultBedtime: 1500 })
  })

  it('未保存なら初期値(24:30)を返す', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.defaultBedtime).toBe(1470)
  })

  it('JSON が壊れていたら初期値を返す(クラッシュしない)', () => {
    localStorage.setItem('sp.v1.settings', '{oops')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('型が合わなければ初期値を返す', () => {
    localStorage.setItem(
      'sp.v1.settings',
      JSON.stringify({ defaultBedtime: '24:30' }),
    )
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('routines', () => {
  it('保存したルーチンを読み戻せる(固定時刻の有無どちらも)', () => {
    const routines: RoutineTask[] = [
      routine,
      { id: 'r2', name: '配信', durationMin: 30, fixedStart: 1320, order: 1 },
    ]
    saveRoutines(routines)
    expect(loadRoutines()).toEqual(routines)
  })

  it('未保存なら空配列を返す', () => {
    expect(loadRoutines()).toEqual([])
  })

  it('配列でない・要素が不正なら空配列を返す', () => {
    localStorage.setItem('sp.v1.routines', JSON.stringify({ not: 'array' }))
    expect(loadRoutines()).toEqual([])

    localStorage.setItem(
      'sp.v1.routines',
      JSON.stringify([routine, { id: 'broken' }]),
    )
    expect(loadRoutines()).toEqual([])
  })
})

describe('tonight plan', () => {
  it('保存したプランを読み戻せる', () => {
    saveTonightPlan(plan)
    expect(loadTonightPlan()).toEqual(plan)
  })

  it('未保存なら null を返す', () => {
    expect(loadTonightPlan()).toBeNull()
  })

  it('items に不正な要素があれば null を返す', () => {
    localStorage.setItem(
      'sp.v1.tonight',
      JSON.stringify({ ...plan, items: [{ id: 'broken' }] }),
    )
    expect(loadTonightPlan()).toBeNull()
  })

  it('clearTonightPlan でプランだけ消える', () => {
    saveSettings({ defaultBedtime: 1500 })
    saveTonightPlan(plan)
    clearTonightPlan()
    expect(loadTonightPlan()).toBeNull()
    expect(loadSettings()).toEqual({ defaultBedtime: 1500 })
  })
})

describe('clearAllData', () => {
  it('全キーが消えて初期値に戻る', () => {
    saveSettings({ defaultBedtime: 1500 })
    saveRoutines([routine])
    saveTonightPlan(plan)
    clearAllData()
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(loadRoutines()).toEqual([])
    expect(loadTonightPlan()).toBeNull()
  })
})

describe('保存失敗時の挙動', () => {
  it('setItem が例外を投げても save は外に投げない', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => saveSettings({ defaultBedtime: 1500 })).not.toThrow()
    expect(console.error).toHaveBeenCalled()
  })
})
