import { toNightMinutes } from '../../lib/time'
import { useRoutines } from '../../hooks/useRoutines'
import { useSettings } from '../../hooks/useSettings'
import { useTonightPlan } from '../../hooks/useTonightPlan'
import { PlanEditor } from './PlanEditor'
import { Timeline } from './Timeline'

export function TonightTab() {
  const { settings } = useSettings()
  const { routines } = useRoutines()
  const {
    plan,
    toggleIncluded,
    moveItem,
    addItem,
    setBedtime,
    start,
    backToEdit,
  } = useTonightPlan(routines, settings.defaultBedtime)
  const now = toNightMinutes(new Date())

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
    <section>
      <h2>今夜のスケジュール</h2>
      <Timeline plan={plan} now={now} />
      <div className="button-row">
        <button type="button" onClick={backToEdit}>
          プランを編集
        </button>
      </div>
    </section>
  )
}
