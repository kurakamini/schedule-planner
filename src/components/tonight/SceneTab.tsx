import type { Scene } from '../../types'
import { useNow } from '../../hooks/useNow'
import { useRoutines } from '../../hooks/useRoutines'
import { useRules } from '../../hooks/useRules'
import { useScenePlan } from '../../hooks/useScenePlan'
import { useScenes } from '../../hooks/useScenes'
import { SceneSwitcher } from '../SceneSwitcher'
import { ExecutionView } from './ExecutionView'
import { PlanEditor } from './PlanEditor'

/** きょうタブ。シーンを選び、そのシーンの当日プランを立てて実行する */
export function SceneTab() {
  const { scenes, currentScene, selectScene } = useScenes()
  return (
    <>
      <SceneSwitcher
        scenes={scenes}
        currentSceneId={currentScene.id}
        onSelect={selectScene}
      />
      {/* シーン切替はフックで追従せず、key で作り直す(docs/spec/design.md) */}
      <SceneContent key={currentScene.id} scene={currentScene} />
    </>
  )
}

function SceneContent({ scene }: { scene: Scene }) {
  const { routines } = useRoutines(scene.id)
  const { rules } = useRules()
  const {
    plan,
    toggleIncluded,
    toggleDone,
    moveItem,
    addItem,
    setEndAt,
    setAnchor,
    start,
    backToEdit,
  } = useScenePlan(scene, routines)
  const now = useNow()

  if (!plan.started) {
    return (
      <PlanEditor
        scene={scene}
        plan={plan}
        onToggle={toggleIncluded}
        onMove={moveItem}
        onAdd={addItem}
        onSetEndAt={setEndAt}
        onSetAnchor={setAnchor}
        onStart={start}
      />
    )
  }

  return (
    <ExecutionView
      scene={scene}
      plan={plan}
      rules={rules}
      now={now}
      onToggleDone={toggleDone}
      onExclude={toggleIncluded}
      onAdd={addItem}
      onEdit={backToEdit}
    />
  )
}
