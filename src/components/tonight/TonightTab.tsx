import { useNow } from '../../hooks/useNow'
import { useRoutines } from '../../hooks/useRoutines'
import { useSettings } from '../../hooks/useSettings'
import { useTonightPlan } from '../../hooks/useTonightPlan'
import { ExecutionView } from './ExecutionView'
import { PlanEditor } from './PlanEditor'

export function TonightTab() {
  const { settings } = useSettings()
  const { routines } = useRoutines()
  const {
    plan,
    toggleIncluded,
    toggleDone,
    moveItem,
    addItem,
    setBedtime,
    start,
    backToEdit,
  } = useTonightPlan(routines, settings.defaultBedtime)
  const now = useNow()

  if (!plan.started) {
    return (
      <PlanEditor
        plan={plan}
        onToggle={toggleIncluded}
        onMove={moveItem}
        onAdd={addItem}
        onSetBedtime={setBedtime}
        onStart={start}
      />
    )
  }

  return (
    <ExecutionView
      plan={plan}
      now={now}
      onToggleDone={toggleDone}
      onExclude={toggleIncluded}
      onAdd={addItem}
      onEdit={backToEdit}
    />
  )
}
