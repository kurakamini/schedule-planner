import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutineTask, ScenePlan } from '../types'
import {
  DEFAULT_SCENE_END,
  clearAllData,
  loadCurrentSceneId,
  loadRoutines,
  loadScenePlan,
  loadScenes,
  removeSceneData,
  saveCurrentSceneId,
  saveRoutines,
  saveScenePlan,
  saveScenes,
} from './storage'

const SCENE = { id: 's1', name: '夜', defaultEnd: 1470, order: 0 }

const routine: RoutineTask = {
  id: 'r1',
  name: '夕食',
  durationMin: 30,
  order: 0,
}

const plan: ScenePlan = {
  dayKey: '2026-07-08',
  endAt: 1470,
  started: true,
  anchorAt: 1270,
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
  baselineEnds: { i1: 1300, i2: 1350 },
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('scenes', () => {
  it('まっさらな初回はデフォルトの「夜」シーンを作って返し、選択中にする', () => {
    const scenes = loadScenes()
    expect(scenes).toHaveLength(1)
    expect(scenes[0].name).toBe('夜')
    expect(scenes[0].defaultEnd).toBe(DEFAULT_SCENE_END)
    expect(loadCurrentSceneId()).toBe(scenes[0].id)
  })

  it('保存したシーンを読み戻せる', () => {
    const scenes = [SCENE, { id: 's2', name: '朝', defaultEnd: 480, order: 1 }]
    saveScenes(scenes)
    expect(loadScenes()).toEqual(scenes)
  })

  it('JSON が壊れていたらデフォルトシーンで作り直す(クラッシュしない)', () => {
    localStorage.setItem('sp.v2.scenes', '{oops')
    const scenes = loadScenes()
    expect(scenes).toHaveLength(1)
    expect(scenes[0].name).toBe('夜')
  })

  it('選択中シーン ID を保存・読み出しできる', () => {
    saveCurrentSceneId('s2')
    expect(loadCurrentSceneId()).toBe('s2')
  })
})

describe('routines(シーンごと)', () => {
  it('保存したルーチンを読み戻せる(固定時刻の有無どちらも)', () => {
    const routines: RoutineTask[] = [
      routine,
      { id: 'r2', name: '配信', durationMin: 30, fixedStart: 1320, order: 1 },
    ]
    saveRoutines('s1', routines)
    expect(loadRoutines('s1')).toEqual(routines)
  })

  it('シーンが違えば別のリストになる', () => {
    saveRoutines('s1', [routine])
    expect(loadRoutines('s2')).toEqual([])
  })

  it('配列でない・要素が不正なら空配列を返す', () => {
    localStorage.setItem('sp.v2.routines.s1', JSON.stringify({ not: 'array' }))
    expect(loadRoutines('s1')).toEqual([])

    localStorage.setItem(
      'sp.v2.routines.s1',
      JSON.stringify([routine, { id: 'broken' }]),
    )
    expect(loadRoutines('s1')).toEqual([])
  })
})

describe('scene plan(シーンごと)', () => {
  it('保存したプランを読み戻せる', () => {
    saveScenePlan('s1', plan)
    expect(loadScenePlan('s1')).toEqual(plan)
    expect(loadScenePlan('s2')).toBeNull()
  })

  it('items に不正な要素があれば null を返す', () => {
    localStorage.setItem(
      'sp.v2.plan.s1',
      JSON.stringify({ ...plan, items: [{ id: 'broken' }] }),
    )
    expect(loadScenePlan('s1')).toBeNull()
  })

  it('removeSceneData でそのシーンのルーチンとプランだけ消える', () => {
    saveRoutines('s1', [routine])
    saveScenePlan('s1', plan)
    saveRoutines('s2', [routine])
    removeSceneData('s1')
    expect(loadRoutines('s1')).toEqual([])
    expect(loadScenePlan('s1')).toBeNull()
    expect(loadRoutines('s2')).toEqual([routine])
  })
})

describe('v1 → v2 移行', () => {
  const v1Tonight = {
    nightKey: '2026-07-08',
    bedtime: 1500,
    started: true,
    anchorAt: 1270,
    items: plan.items,
    baselineEnds: plan.baselineEnds,
  }

  function seedV1() {
    localStorage.setItem(
      'sp.v1.settings',
      JSON.stringify({ defaultBedtime: 1500 }),
    )
    localStorage.setItem('sp.v1.routines', JSON.stringify([routine]))
    localStorage.setItem('sp.v1.tonight', JSON.stringify(v1Tonight))
  }

  it('v1 データが「夜」シーンとして引き継がれ、v1 キーは消える', () => {
    seedV1()
    const scenes = loadScenes()

    expect(scenes).toHaveLength(1)
    expect(scenes[0].name).toBe('夜')
    expect(scenes[0].defaultEnd).toBe(1500) // v1 のデフォルト就寝時刻
    expect(loadCurrentSceneId()).toBe(scenes[0].id)
    expect(loadRoutines(scenes[0].id)).toEqual([routine])
    // nightKey→dayKey / bedtime→endAt の変換込みで引き継がれる
    expect(loadScenePlan(scenes[0].id)).toEqual({
      dayKey: '2026-07-08',
      endAt: 1500,
      started: true,
      anchorAt: 1270,
      items: plan.items,
      baselineEnds: plan.baselineEnds,
    })
    expect(localStorage.getItem('sp.v1.settings')).toBeNull()
    expect(localStorage.getItem('sp.v1.routines')).toBeNull()
    expect(localStorage.getItem('sp.v1.tonight')).toBeNull()
  })

  it('移行は一度だけ(v2 があれば v1 が残っていても触らない)', () => {
    saveScenes([SCENE])
    localStorage.setItem('sp.v1.routines', JSON.stringify([routine]))
    expect(loadScenes()).toEqual([SCENE])
    expect(loadRoutines(SCENE.id)).toEqual([])
  })

  it('v1 の一部が壊れていても読める分だけ引き継ぐ', () => {
    seedV1()
    localStorage.setItem('sp.v1.tonight', '{oops')
    const scenes = loadScenes()
    expect(scenes[0].defaultEnd).toBe(1500)
    expect(loadRoutines(scenes[0].id)).toEqual([routine])
    expect(loadScenePlan(scenes[0].id)).toBeNull()
  })
})

describe('clearAllData', () => {
  it('sp. 配下の全キーが消えて初期状態に戻る', () => {
    saveScenes([SCENE])
    saveCurrentSceneId(SCENE.id)
    saveRoutines(SCENE.id, [routine])
    saveScenePlan(SCENE.id, plan)
    localStorage.setItem('sp.v1.routines', JSON.stringify([routine])) // v1 の残骸
    localStorage.setItem('unrelated', 'keep')

    clearAllData()

    expect(localStorage.getItem('sp.v2.scenes')).toBeNull()
    expect(localStorage.getItem('sp.v1.routines')).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('keep')
    // 次の読み込みで初期シーンが作り直される
    const scenes = loadScenes()
    expect(scenes).toHaveLength(1)
    expect(scenes[0].name).toBe('夜')
  })
})

describe('保存失敗時の挙動', () => {
  it('setItem が例外を投げても save は外に投げない', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => saveScenes([SCENE])).not.toThrow()
    expect(console.error).toHaveBeenCalled()
  })
})
