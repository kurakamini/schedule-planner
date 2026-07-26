import type { PlanItem, TonightPlan } from '../../types'
import type { Scheduled } from '../../lib/scheduler'
import { buildSchedule } from '../../lib/scheduler'
import type { MascotState } from '../../lib/mascot'
import { pickMascotLine } from '../../lib/mascot'
import { formatDuration, formatNightTime } from '../../lib/time'
import type { AdhocInput } from '../../hooks/useTonightPlan'
import { AdhocForm } from './AdhocForm'
import { Mascot } from './Mascot'
import { Timeline } from './Timeline'

type Props = {
  plan: TonightPlan
  now: number
  onToggleDone: (id: string) => void
  onExclude: (id: string) => void
  onAdd: (input: AdhocInput) => void
  onEdit: () => void
}

export function ExecutionView({
  plan,
  now,
  onToggleDone,
  onExclude,
  onAdd,
  onEdit,
}: Props) {
  const included = plan.items.filter((it) => it.included)
  const pending = included.filter((it) => !it.done)
  // 配置はアンカー(開始時刻/最後の操作時点)を起点にする。
  // now(現在時刻)は残り時間などのカウントダウン表示にだけ使い、
  // 時間経過や開き直しでタイムラインの時刻が動かないようにする
  const schedule = buildSchedule({
    items: pending,
    now: plan.anchorAt,
    bedtime: plan.bedtime,
  })
  const byId = new Map(plan.items.map((it) => [it.id, it]))

  const allDone = included.length > 0 && pending.length === 0
  const current = schedule.scheduled[0]
  const currentItem = current ? byId.get(current.itemId) : undefined
  const untilBedtime = plan.bedtime - now

  return (
    <section>
      <h2>今夜のスケジュール</h2>
      <p className="exec-header">
        就寝まで {untilBedtime >= 0 ? formatDuration(untilBedtime) : '—(就寝時刻を過ぎています)'}
        ・自由時間 合計 {formatDuration(schedule.freeTotalMin)}
      </p>

      <Mascot
        line={pickMascotLine(
          toMascotState({
            plan,
            now,
            untilBedtime,
            hasItems: included.length > 0,
            allDone,
            current,
            currentItem,
          }),
        )}
      />

      {allDone ? (
        <div className="celebration">
          <p className="celebration-emoji">🎉</p>
          <p className="celebration-title">おつかれさま!全部終わりました</p>
          <p>
            {untilBedtime > 0
              ? `就寝まで自由時間 ${formatDuration(untilBedtime)}。堂々とどうぞ`
              : '就寝時刻を過ぎています。ゆっくり休んでください'}
          </p>
        </div>
      ) : (
        currentItem &&
        current && (
          <div className="now-card">
            {current.start > now ? (
              <>
                <p className="now-label">次は {formatNightTime(current.start)} から</p>
                <p className="now-task">
                  {currentItem.fixedStart !== undefined && '📌 '}
                  {currentItem.name}
                </p>
                <p className="now-until">
                  それまで自由時間 {formatDuration(current.start - now)}
                </p>
              </>
            ) : (
              <>
                <p className="now-label">いまやる</p>
                <p className="now-task">
                  {currentItem.fixedStart !== undefined && '📌 '}
                  {currentItem.name}
                </p>
                <p className="now-until">
                  {current.end >= now
                    ? `${formatNightTime(current.end)} まで(残り ${formatDuration(current.end - now)})`
                    : `終了予定 ${formatNightTime(current.end)} を過ぎています`}
                </p>
              </>
            )}
            <button
              type="button"
              className="btn-primary btn-large"
              onClick={() => onToggleDone(currentItem.id)}
            >
              完了
            </button>
          </div>
        )
      )}

      {included.length === 0 && (
        <p className="placeholder">
          今夜やるタスクがありません。「プランを編集」から選び直してください。
        </p>
      )}

      <Timeline
        plan={plan}
        schedule={schedule}
        currentItemId={currentItem?.id}
        onToggleDone={onToggleDone}
        onExclude={onExclude}
      />

      <details className="adhoc-details">
        <summary>タスクを追加</summary>
        <AdhocForm onAdd={onAdd} />
      </details>

      <div className="button-row">
        <button type="button" onClick={onEdit}>
          プランを編集
        </button>
      </div>
    </section>
  )
}

/** 表示中の状態をミニキャラのセリフ判定用にまとめ直す */
function toMascotState(input: {
  plan: TonightPlan
  now: number
  untilBedtime: number
  hasItems: boolean
  allDone: boolean
  current?: Scheduled
  currentItem?: PlanItem
}): MascotState {
  const { plan, now, untilBedtime, hasItems, allDone, current, currentItem } =
    input
  const base = { nightKey: plan.nightKey, untilBedtime }

  if (!hasItems) return { ...base, kind: 'empty' }
  if (allDone) return { ...base, kind: 'allDone' }
  if (!current || !currentItem) return { ...base, kind: 'empty' }

  const task = { taskId: currentItem.id, taskName: currentItem.name }
  if (current.start > now) {
    return {
      ...base,
      ...task,
      kind: 'waiting',
      startAt: current.start,
      waitMin: current.start - now,
    }
  }
  return { ...base, ...task, kind: 'now', leftMin: current.end - now }
}
