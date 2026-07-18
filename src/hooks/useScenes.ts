import { useCallback, useState } from 'react'
import type { Scene } from '../types'
import { generateId } from '../lib/id'
import {
  loadCurrentSceneId,
  loadScenes,
  removeSceneData,
  saveCurrentSceneId,
  saveScenes,
} from '../lib/storage'

export type SceneInput = {
  name: string
  /** undefined = 終了なし(所要時間だけで組むシーン) */
  defaultEnd?: number
}

/** order を 0 始まりの連番に振り直す(常にこの形で保存する) */
function renumber(list: Scene[]): Scene[] {
  return list.map((s, i) => ({ ...s, order: i }))
}

type State = {
  scenes: Scene[]
  currentSceneId: string
}

/**
 * シーン一覧と選択中シーンの管理。
 * loadScenes が初期化(v1 移行・デフォルトシーン作成)を担うため、シーンは常に 1 件以上。
 * 選択中 ID が消えたシーンを指していたら先頭へフォールバックする
 */
function initialState(): State {
  const scenes = [...loadScenes()].sort((a, b) => a.order - b.order)
  const stored = loadCurrentSceneId()
  const currentSceneId = scenes.some((s) => s.id === stored)
    ? (stored as string)
    : scenes[0].id
  return { scenes, currentSceneId }
}

export function useScenes() {
  const [state, setState] = useState<State>(initialState)

  const mutate = useCallback((fn: (prev: State) => State) => {
    setState((prev) => {
      const result = fn(prev)
      if (result === prev) return prev // 変更なし(削除ガード等)は保存しない
      const next = { ...result, scenes: renumber(result.scenes) }
      saveScenes(next.scenes)
      if (next.currentSceneId !== prev.currentSceneId) {
        saveCurrentSceneId(next.currentSceneId)
      }
      return next
    })
  }, [])

  const selectScene = useCallback((id: string) => {
    setState((prev) => {
      if (!prev.scenes.some((s) => s.id === id)) return prev
      saveCurrentSceneId(id)
      return { ...prev, currentSceneId: id }
    })
  }, [])

  const addScene = useCallback(
    (input: SceneInput) => {
      mutate((prev) => ({
        ...prev,
        scenes: [
          ...prev.scenes,
          { ...input, id: generateId(), order: prev.scenes.length },
        ],
      }))
    },
    [mutate],
  )

  const updateScene = useCallback(
    (id: string, input: SceneInput) => {
      mutate((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === id
            ? { ...s, name: input.name, defaultEnd: input.defaultEnd }
            : s,
        ),
      }))
    },
    [mutate],
  )

  /** シーン削除。最後の 1 つは消せない。配下のルーチン・プランも一緒に消す */
  const removeScene = useCallback(
    (id: string) => {
      mutate((prev) => {
        if (prev.scenes.length <= 1) return prev
        const scenes = prev.scenes.filter((s) => s.id !== id)
        if (scenes.length === prev.scenes.length) return prev
        removeSceneData(id)
        return {
          scenes,
          currentSceneId:
            prev.currentSceneId === id ? scenes[0].id : prev.currentSceneId,
        }
      })
    },
    [mutate],
  )

  /** clearAllData 実行後などに localStorage から読み直す */
  const reload = useCallback(() => {
    setState(initialState())
  }, [])

  const currentScene =
    state.scenes.find((s) => s.id === state.currentSceneId) ?? state.scenes[0]

  return {
    scenes: state.scenes,
    currentScene,
    selectScene,
    addScene,
    updateScene,
    removeScene,
    reload,
  }
}
