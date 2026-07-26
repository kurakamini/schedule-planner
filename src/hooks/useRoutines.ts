import { useCallback, useState } from 'react'
import type { RoutineTask } from '../types'
import { generateId } from '../lib/id'
import { loadRoutines, saveRoutines } from '../lib/storage'

export type RoutineInput = {
  name: string
  durationMin: number
  fixedStart?: number
}

/** order を 0 始まりの連番に振り直す(常にこの形で保存する) */
function renumber(list: RoutineTask[]): RoutineTask[] {
  return list.map((r, i) => ({ ...r, order: i }))
}

/** シーンごとのルーチン CRUD。シーン切替時は key={scene.id} の再マウントで作り直す前提 */
export function useRoutines(sceneId: string) {
  const [routines, setRoutines] = useState<RoutineTask[]>(() =>
    [...loadRoutines(sceneId)].sort((a, b) => a.order - b.order),
  )

  const mutate = useCallback(
    (fn: (prev: RoutineTask[]) => RoutineTask[]) => {
      setRoutines((prev) => {
        const next = renumber(fn(prev))
        saveRoutines(sceneId, next)
        return next
      })
    },
    [sceneId],
  )

  const add = useCallback(
    (input: RoutineInput) => {
      mutate((prev) => [
        ...prev,
        { ...input, id: generateId(), order: prev.length },
      ])
    },
    [mutate],
  )

  const update = useCallback(
    (id: string, input: RoutineInput) => {
      mutate((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                name: input.name,
                durationMin: input.durationMin,
                // undefined なら固定時刻を外す(スプレッドだと残るため明示代入)
                fixedStart: input.fixedStart,
              }
            : r,
        ),
      )
    },
    [mutate],
  )

  const remove = useCallback(
    (id: string) => {
      mutate((prev) => prev.filter((r) => r.id !== id))
    },
    [mutate],
  )

  const move = useCallback(
    (id: string, direction: -1 | 1) => {
      mutate((prev) => {
        const i = prev.findIndex((r) => r.id === id)
        const j = i + direction
        if (i < 0 || j < 0 || j >= prev.length) return prev
        const next = [...prev]
        ;[next[i], next[j]] = [next[j], next[i]]
        return next
      })
    },
    [mutate],
  )

  return { routines, add, update, remove, move }
}
