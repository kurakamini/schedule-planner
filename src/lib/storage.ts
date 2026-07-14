// localStorage 永続化層。docs/spec/design.md「localStorage(v2)」準拠。
// 読み込みは JSON 破損・型不一致でも初期値にフォールバックし、決してクラッシュしない。
// キーの v2 はスキーマ版数。v1(単一ルーチン・単一プラン)からは起動時に移行する。

import type { PlanItem, RoutineTask, Scene, ScenePlan } from '../types'
import { generateId } from './id'

const KEYS = {
  scenes: 'sp.v2.scenes',
  currentSceneId: 'sp.v2.currentSceneId',
} as const

const routinesKey = (sceneId: string) => `sp.v2.routines.${sceneId}`
const planKey = (sceneId: string) => `sp.v2.plan.${sceneId}`

const V1_KEYS = {
  settings: 'sp.v1.settings',
  routines: 'sp.v1.routines',
  tonight: 'sp.v1.tonight',
} as const

/** デフォルト終了時刻 24:30(夜通算分)。初期シーン「夜」の就寝時刻 */
export const DEFAULT_SCENE_END = 1470

function createDefaultScene(defaultEnd = DEFAULT_SCENE_END): Scene {
  return { id: generateId(), name: '夜', defaultEnd, order: 0 }
}

/**
 * シーン一覧を読む。v2 が未初期化なら v1 からの移行(または初期シーン作成)を行うため、
 * アプリ起動時に最初に呼ばれる読み込みでもある。必ず 1 件以上を返す
 */
export function loadScenes(): Scene[] {
  migrateV1IfNeeded()
  const scenes = load(KEYS.scenes, isSceneArray, [])
  if (scenes.length > 0) return scenes
  const scene = createDefaultScene()
  saveScenes([scene])
  saveCurrentSceneId(scene.id)
  return [scene]
}

export function saveScenes(scenes: Scene[]): void {
  save(KEYS.scenes, scenes)
}

export function loadCurrentSceneId(): string | null {
  return load(KEYS.currentSceneId, isString, null)
}

export function saveCurrentSceneId(sceneId: string): void {
  save(KEYS.currentSceneId, sceneId)
}

export function loadRoutines(sceneId: string): RoutineTask[] {
  return load(routinesKey(sceneId), isRoutineTaskArray, [])
}

export function saveRoutines(sceneId: string, routines: RoutineTask[]): void {
  save(routinesKey(sceneId), routines)
}

export function loadScenePlan(sceneId: string): ScenePlan | null {
  return load(planKey(sceneId), isScenePlan, null)
}

export function saveScenePlan(sceneId: string, plan: ScenePlan): void {
  save(planKey(sceneId), plan)
}

/** シーン削除時に、そのシーンのルーチン・当日プランも一緒に消す(ゴミを残さない) */
export function removeSceneData(sceneId: string): void {
  try {
    localStorage.removeItem(routinesKey(sceneId))
    localStorage.removeItem(planKey(sceneId))
  } catch {
    // 消せなくても続行する
  }
}

/** 設定タブの「データ全消去」用。sp. 配下(v1 の残骸含む)をすべて消す */
export function clearAllData(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key !== null && key.startsWith('sp.')) localStorage.removeItem(key)
    }
  } catch {
    // 同上
  }
}

// ---- v1 → v2 移行 ----

/** v1 の TonightPlan(nightKey / bedtime 時代)。移行時の検証にだけ使う */
type V1TonightPlan = {
  nightKey: string
  bedtime: number
  started: boolean
  anchorAt: number
  items: PlanItem[]
  baselineEnds?: Record<string, number>
}

/**
 * v2 が未初期化(sp.v2.scenes が無い)とき、v1 のデータを「夜」シーンとして引き継ぐ。
 * デフォルト終了時刻 = v1 のデフォルト就寝時刻。routines / 当夜プランはそのシーンのキーへ移す。
 * 移行後(または v1 が壊れていて読めなかった場合も)v1 キーは削除する
 */
function migrateV1IfNeeded(): void {
  try {
    if (localStorage.getItem(KEYS.scenes) !== null) return
    const hasV1 = Object.values(V1_KEYS).some(
      (key) => localStorage.getItem(key) !== null,
    )
    if (!hasV1) return

    const settings = load(V1_KEYS.settings, isV1Settings, null)
    const scene = createDefaultScene(settings?.defaultBedtime)
    saveScenes([scene])
    saveCurrentSceneId(scene.id)

    const routines = load(V1_KEYS.routines, isRoutineTaskArray, [])
    if (routines.length > 0) saveRoutines(scene.id, routines)

    const tonight = load(V1_KEYS.tonight, isV1TonightPlan, null)
    if (tonight !== null) {
      const { nightKey, bedtime, ...rest } = tonight
      saveScenePlan(scene.id, { ...rest, dayKey: nightKey, endAt: bedtime })
    }

    for (const key of Object.values(V1_KEYS)) localStorage.removeItem(key)
  } catch {
    // localStorage 不使用環境などでは何もしない(以降の load がフォールバックする)
  }
}

function load<T, F>(
  key: string,
  validate: (value: unknown) => value is T,
  fallback: F,
): T | F {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    return validate(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // 容量超過など。保存失敗でアプリは止めない(次の保存で回復を試みる)
    console.error(`localStorage への保存に失敗: ${key}`, e)
  }
}

// ---- バリデータ(JSON.parse 結果の型チェック) ----

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isOptional(v: unknown, type: 'number' | 'string'): boolean {
  return v === undefined || typeof v === type
}

function isScene(v: unknown): v is Scene {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.defaultEnd === 'number' &&
    typeof v.order === 'number'
  )
}

function isSceneArray(v: unknown): v is Scene[] {
  return Array.isArray(v) && v.every(isScene)
}

function isV1Settings(v: unknown): v is { defaultBedtime: number } {
  return isRecord(v) && typeof v.defaultBedtime === 'number'
}

function isRoutineTask(v: unknown): v is RoutineTask {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.durationMin === 'number' &&
    isOptional(v.fixedStart, 'number') &&
    typeof v.order === 'number'
  )
}

function isRoutineTaskArray(v: unknown): v is RoutineTask[] {
  return Array.isArray(v) && v.every(isRoutineTask)
}

function isPlanItem(v: unknown): v is PlanItem {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    isOptional(v.routineId, 'string') &&
    typeof v.name === 'string' &&
    typeof v.durationMin === 'number' &&
    isOptional(v.fixedStart, 'number') &&
    typeof v.order === 'number' &&
    typeof v.included === 'boolean' &&
    typeof v.done === 'boolean' &&
    isOptional(v.doneAt, 'number')
  )
}

function isBaselineEnds(v: unknown): boolean {
  return (
    v === undefined ||
    (isRecord(v) && Object.values(v).every((end) => typeof end === 'number'))
  )
}

/** dayKey / endAt 以外の共通部分の検証 */
function isPlanBody(v: Record<string, unknown>): boolean {
  return (
    typeof v.started === 'boolean' &&
    typeof v.anchorAt === 'number' &&
    Array.isArray(v.items) &&
    v.items.every(isPlanItem) &&
    isBaselineEnds(v.baselineEnds)
  )
}

function isScenePlan(v: unknown): v is ScenePlan {
  return (
    isRecord(v) &&
    typeof v.dayKey === 'string' &&
    typeof v.endAt === 'number' &&
    isPlanBody(v)
  )
}

function isV1TonightPlan(v: unknown): v is V1TonightPlan {
  return (
    isRecord(v) &&
    typeof v.nightKey === 'string' &&
    typeof v.bedtime === 'number' &&
    isPlanBody(v)
  )
}
