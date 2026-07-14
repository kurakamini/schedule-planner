import type { Scene, ScenePlan } from '../../types'
import { buildSchedule } from '../../lib/scheduler'
import { deltaClass, formatDelta, overallDelta } from '../../lib/rta'
import { formatDuration, formatNightTime } from '../../lib/time'
import type { AdhocInput } from '../../hooks/useScenePlan'
import { AdhocForm } from './AdhocForm'
import { Timeline } from './Timeline'

type Props = {
  scene: Scene
  plan: ScenePlan
  now: number
  onToggleDone: (id: string) => void
  onExclude: (id: string) => void
  onAdd: (input: AdhocInput) => void
  onEdit: () => void
}

export function ExecutionView({
  scene,
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
    endAt: plan.endAt,
  })
  const byId = new Map(plan.items.map((it) => [it.id, it]))

  const allDone = included.length > 0 && pending.length === 0
  const current = schedule.scheduled[0]
  const currentItem = current ? byId.get(current.itemId) : undefined
  const untilEnd = plan.endAt - now
  // RTA 風の予定比: 開始時に凍結した基準タイムと現在の終了見込みの差
  const delta = overallDelta(plan, schedule)

  return (
    <section>
      <h2>{scene.name}のスケジュール</h2>
      <p className="exec-header">
        終了まで {untilEnd >= 0 ? formatDuration(untilEnd) : '—(終了時刻を過ぎています)'}
        ・自由時間 合計 {formatDuration(schedule.freeTotalMin)}
        {delta !== null && (
          <>
            ・予定比{' '}
            <span className={`delta ${deltaClass(delta)}`}>
              {formatDelta(delta)}
            </span>
          </>
        )}
      </p>

      {allDone ? (
        <div className="celebration">
          <p className="celebration-emoji">🎉</p>
          <p className="celebration-title">おつかれさま!全部終わりました</p>
          <p>
            {untilEnd > 0
              ? `終了まで自由時間 ${formatDuration(untilEnd)}。堂々とどうぞ`
              : '終了時刻を過ぎています。おつかれさまでした'}
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
          きょうやるタスクがありません。「プランを編集」から選び直してください。
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
