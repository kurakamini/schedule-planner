// localStorage 永続化層。docs/spec/design.md「localStorage」準拠。
// 読み込みは JSON 破損・型不一致でも初期値にフォールバックし、決してクラッシュしない。
// キーの v1 はスキーマ版数。構造を変えるときは v2 キー+移行コードで対応する。

import type { PlanItem, RoutineTask, Settings, TonightPlan } from '../types'

const KEYS = {
  settings: 'sp.v1.settings',
  routines: 'sp.v1.routines',
  tonight: 'sp.v1.tonight',
} as const

/** デフォルト就寝時刻 24:30(夜通算分) */
export const DEFAULT_SETTINGS: Settings = { defaultBedtime: 1470 }

export function loadSettings(): Settings {
  return load(KEYS.settings, isSettings, DEFAULT_SETTINGS)
}

export function saveSettings(settings: Settings): void {
  save(KEYS.settings, settings)
}

export function loadRoutines(): RoutineTask[] {
  return load(KEYS.routines, isRoutineTaskArray, [])
}

export function saveRoutines(routines: RoutineTask[]): void {
  save(KEYS.routines, routines)
}

export function loadTonightPlan(): TonightPlan | null {
  return load(KEYS.tonight, isTonightPlan, null)
}

export function saveTonightPlan(plan: TonightPlan): void {
  save(KEYS.tonight, plan)
}

/** 夜境界リセット(F5)用 */
export function clearTonightPlan(): void {
  try {
    localStorage.removeItem(KEYS.tonight)
  } catch {
    // 消せなくても起動は継続する
  }
}

/** 設定タブの「データ全消去」用 */
export function clearAllData(): void {
  try {
    for (const key of Object.values(KEYS)) {
      localStorage.removeItem(key)
    }
  } catch {
    // 同上
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

function isOptional(v: unknown, type: 'number' | 'string'): boolean {
  return v === undefined || typeof v === type
}

function isSettings(v: unknown): v is Settings {
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

function isTonightPlan(v: unknown): v is TonightPlan {
  return (
    isRecord(v) &&
    typeof v.nightKey === 'string' &&
    typeof v.bedtime === 'number' &&
    typeof v.started === 'boolean' &&
    Array.isArray(v.items) &&
    v.items.every(isPlanItem)
  )
}
