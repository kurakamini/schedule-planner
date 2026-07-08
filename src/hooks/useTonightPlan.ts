import { useCallback, useEffect, useState } from 'react'
import type { PlanItem, RoutineTask, TonightPlan } from '../types'
import { getNightKey } from '../lib/time'
import { loadTonightPlan, saveTonightPlan } from '../lib/storage'

export type AdhocInput = {
  name: string
  durationMin: number
  fixedStart?: number
}

function routineToItem(r: RoutineTask, order: number): PlanItem {
  return {
    id: crypto.randomUUID(),
    routineId: r.id,
    name: r.name,
    durationMin: r.durationMin,
    fixedStart: r.fixedStart,
    order,
    included: true,
    done: false,
  }
}

function renumber(items: PlanItem[]): PlanItem[] {
  return items.map((it, i) => ({ ...it, order: i }))
}

/**
 * プラン未作成ならルーチン全件を選択済みで初期化する。
 * 作成ビュー表示中(started: false)は、あとから登録されたルーチンを末尾に取り込む
 * (当夜の調整=チェック・並び順・当日タスクはそのまま残す)。
 */
function syncWithRoutines(
  prev: TonightPlan | null,
  routines: RoutineTask[],
  defaultBedtime: number,
): TonightPlan {
  if (prev?.started) return prev
  if (!prev) {
    return {
      nightKey: getNightKey(new Date()),
      bedtime: defaultBedtime,
      started: false,
      items: routines.map((r, i) => routineToItem(r, i)),
    }
  }
  const known = new Set(
    prev.items.map((it) => it.routineId).filter((id) => id !== undefined),
  )
  const missing = routines.filter((r) => !known.has(r.id))
  if (missing.length === 0) return prev
  return {
    ...prev,
    items: renumber([
      ...prev.items,
      ...missing.map((r, i) => routineToItem(r, prev.items.length + i)),
    ]),
  }
}

export function useTonightPlan(routines: RoutineTask[], defaultBedtime: number) {
  const [plan, setPlan] = useState<TonightPlan>(() =>
    syncWithRoutines(loadTonightPlan(), routines, defaultBedtime),
  )

  // ルーチンの後追い登録を作成ビューに反映する。
  // 同期結果は毎回保存し、表示中のプランとストレージを常に一致させる
  // (保存しないと、導出だけされたプランが再マウントのたびに作り直される)
  useEffect(() => {
    setPlan((prev) => {
      const next = syncWithRoutines(prev, routines, defaultBedtime)
      saveTonightPlan(next)
      return next
    })
  }, [routines, defaultBedtime])

  const mutate = useCallback((fn: (prev: TonightPlan) => TonightPlan) => {
    setPlan((prev) => {
      const next = fn(prev)
      saveTonightPlan(next)
      return next
    })
  }, [])

  const toggleIncluded = useCallback(
    (id: string) => {
      mutate((prev) => ({
        ...prev,
        items: prev.items.map((it) =>
          it.id === id ? { ...it, included: !it.included } : it,
        ),
      }))
    },
    [mutate],
  )

  const moveItem = useCallback(
    (id: string, direction: -1 | 1) => {
      mutate((prev) => {
        const items = [...prev.items].sort((a, b) => a.order - b.order)
        const i = items.findIndex((it) => it.id === id)
        const j = i + direction
        if (i < 0 || j < 0 || j >= items.length) return prev
        ;[items[i], items[j]] = [items[j], items[i]]
        return { ...prev, items: renumber(items) }
      })
    },
    [mutate],
  )

  const addItem = useCallback(
    (input: AdhocInput) => {
      mutate((prev) => ({
        ...prev,
        items: renumber([
          ...prev.items,
          {
            id: crypto.randomUUID(),
            name: input.name,
            durationMin: input.durationMin,
            fixedStart: input.fixedStart,
            order: prev.items.length,
            included: true,
            done: false,
          },
        ]),
      }))
    },
    [mutate],
  )

  const setBedtime = useCallback(
    (bedtime: number) => {
      mutate((prev) => ({ ...prev, bedtime }))
    },
    [mutate],
  )

  const start = useCallback(() => {
    mutate((prev) => ({ ...prev, started: true }))
  }, [mutate])

  const backToEdit = useCallback(() => {
    mutate((prev) => ({ ...prev, started: false }))
  }, [mutate])

  return { plan, toggleIncluded, moveItem, addItem, setBedtime, start, backToEdit }
}
