import type { Scene } from '../types'

type Props = {
  scenes: Scene[]
  currentSceneId: string
  onSelect: (id: string) => void
}

/** シーン切り替えチップ(きょう / ルーチンタブの上部に置く) */
export function SceneSwitcher({ scenes, currentSceneId, onSelect }: Props) {
  if (scenes.length <= 1) return null // 1 つだけなら選ぶ余地がないので出さない
  return (
    <div className="scene-switcher" aria-label="シーン切り替え">
      {scenes.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`scene-chip${s.id === currentSceneId ? ' scene-chip-active' : ''}`}
          aria-pressed={s.id === currentSceneId}
          onClick={() => onSelect(s.id)}
        >
          {s.name}
        </button>
      ))}
    </div>
  )
}
