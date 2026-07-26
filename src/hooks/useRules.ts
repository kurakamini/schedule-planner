import { useCallback, useState } from 'react'
import type { Rule, RuleTrigger } from '../types'
import { generateId } from '../lib/id'
import { loadRules, saveRules } from '../lib/storage'

export type RuleInput = { trigger: RuleTrigger; action: string }

/** order を 0 始まりの連番に振り直す(常にこの形で保存する) */
function renumber(list: Rule[]): Rule[] {
  return list.map((r, i) => ({ ...r, order: i }))
}

/** if-then ルールの CRUD。シーンをまたいで共通 */
export function useRules() {
  const [rules, setRules] = useState<Rule[]>(() =>
    [...loadRules()].sort((a, b) => a.order - b.order),
  )

  const mutate = useCallback((fn: (prev: Rule[]) => Rule[]) => {
    setRules((prev) => {
      const next = renumber(fn(prev))
      saveRules(next)
      return next
    })
  }, [])

  const add = useCallback(
    (input: RuleInput) => {
      mutate((prev) => [
        ...prev,
        { ...input, id: generateId(), order: prev.length },
      ])
    },
    [mutate],
  )

  const update = useCallback(
    (id: string, input: RuleInput) => {
      mutate((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, trigger: input.trigger, action: input.action } : r,
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

  return { rules, add, update, remove, move }
}
