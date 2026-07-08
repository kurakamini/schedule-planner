import type { PlanItem, TonightPlan } from '../../types'
import type { ScheduleResult, Warning } from '../../lib/scheduler'
import { formatDuration, formatNightTime } from '../../lib/time'

type Row =
  | { kind: 'task'; start: number; end: number; item: PlanItem; overflow: boolean }
  | { kind: 'free'; start: number; minutes: number }

function warningText(w: Warning, byId: Map<string, PlanItem>): string {
  switch (w.type) {
    case 'overBedtime':
      return `就寝までに ${formatDuration(w.overrunMin)} 収まりません。タスクを外すか就寝時刻を調整してください`
    case 'fixedOverlap':
      return `固定時刻の予定「${byId.get(w.itemIds[0])?.name}」と「${byId.get(w.itemIds[1])?.name}」が重なっています`
    case 'fixedPast':
      return `「${byId.get(w.itemId)?.name}」の開始時刻を過ぎています`
  }
}

type Props = {
  plan: TonightPlan
  schedule: ScheduleResult
  /** NOW カードに出ている「今やるタスク」。行を強調表示する */
  currentItemId?: string
  onToggleDone: (id: string) => void
  onExclude: (id: string) => void
}

export function Timeline({
  plan,
  schedule,
  currentItemId,
  onToggleDone,
  onExclude,
}: Props) {
  const byId = new Map(plan.items.map((it) => [it.id, it]))
  const overflow = new Set(schedule.overflowItemIds)

  const doneItems = plan.items
    .filter((it) => it.included && it.done)
    .sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0))

  const rows: Row[] = [
    ...schedule.scheduled.map((s) => ({
      kind: 'task' as const,
      start: s.start,
      end: s.end,
      item: byId.get(s.itemId)!,
      overflow: overflow.has(s.itemId),
    })),
    ...schedule.gaps.map((g) => ({
      kind: 'free' as const,
      start: g.start,
      minutes: g.end - g.start,
    })),
  ]
  if (schedule.freeAfterMin > 0) {
    rows.push({
      kind: 'free',
      start: plan.bedtime - schedule.freeAfterMin,
      minutes: schedule.freeAfterMin,
    })
  }
  rows.sort((a, b) => a.start - b.start)

  return (
    <div className="timeline">
      {schedule.warnings.length > 0 && (
        <div className="warning-banner" role="alert">
          {schedule.warnings.map((w, i) => (
            <p key={i}>⚠ {warningText(w, byId)}</p>
          ))}
        </div>
      )}

      {doneItems.length === 0 && rows.length === 0 ? (
        <p className="placeholder">表示するタスクがありません。</p>
      ) : (
        <ul className="tl-list">
          {doneItems.map((item) => (
            <li key={item.id} className="tl-row tl-done">
              <input
                type="checkbox"
                checked
                aria-label={`${item.name} の完了を取り消す`}
                onChange={() => onToggleDone(item.id)}
              />
              <span className="tl-time">
                {item.doneAt !== undefined
                  ? `${formatNightTime(item.doneAt)} 完了`
                  : '完了'}
              </span>
              <span className="tl-name">{item.name}</span>
            </li>
          ))}

          {rows.map((row) =>
            row.kind === 'task' ? (
              <li
                key={row.item.id}
                className={`tl-row${row.overflow ? ' tl-overflow' : ''}${
                  row.item.id === currentItemId ? ' tl-current' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={false}
                  aria-label={`${row.item.name} を完了にする`}
                  onChange={() => onToggleDone(row.item.id)}
                />
                <span className="tl-time">
                  {formatNightTime(row.start)}〜{formatNightTime(row.end)}
                </span>
                <span className="tl-name">
                  {row.item.fixedStart !== undefined && '📌 '}
                  {row.item.name}
                </span>
                <button
                  type="button"
                  className="tl-exclude"
                  aria-label={`${row.item.name} を外す`}
                  onClick={() => onExclude(row.item.id)}
                >
                  外す
                </button>
              </li>
            ) : (
              <li key={`free-${row.start}`} className="tl-row tl-free">
                <span className="tl-time">{formatNightTime(row.start)}〜</span>
                <span className="tl-name">
                  自由時間 {formatDuration(row.minutes)}
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}
