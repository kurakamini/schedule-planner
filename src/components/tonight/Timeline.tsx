import type { PlanItem, TonightPlan } from '../../types'
import { buildSchedule } from '../../lib/scheduler'
import type { Warning } from '../../lib/scheduler'
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

export function Timeline({ plan, now }: { plan: TonightPlan; now: number }) {
  const targets = plan.items.filter((it) => it.included && !it.done)
  const result = buildSchedule({ items: targets, now, bedtime: plan.bedtime })
  const byId = new Map(plan.items.map((it) => [it.id, it]))
  const overflow = new Set(result.overflowItemIds)

  const rows: Row[] = [
    ...result.scheduled.map((s) => ({
      kind: 'task' as const,
      start: s.start,
      end: s.end,
      item: byId.get(s.itemId)!,
      overflow: overflow.has(s.itemId),
    })),
    ...result.gaps.map((g) => ({
      kind: 'free' as const,
      start: g.start,
      minutes: g.end - g.start,
    })),
  ]
  if (result.freeAfterMin > 0) {
    rows.push({
      kind: 'free',
      start: plan.bedtime - result.freeAfterMin,
      minutes: result.freeAfterMin,
    })
  }
  rows.sort((a, b) => a.start - b.start)

  return (
    <div className="timeline">
      {result.warnings.length > 0 && (
        <div className="warning-banner" role="alert">
          {result.warnings.map((w, i) => (
            <p key={i}>⚠ {warningText(w, byId)}</p>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="placeholder">表示するタスクがありません。</p>
      ) : (
        <ul className="tl-list">
          {rows.map((row) =>
            row.kind === 'task' ? (
              <li
                key={row.item.id}
                className={`tl-row${row.overflow ? ' tl-overflow' : ''}`}
              >
                <span className="tl-time">
                  {formatNightTime(row.start)}〜{formatNightTime(row.end)}
                </span>
                <span className="tl-name">
                  {row.item.fixedStart !== undefined && '📌 '}
                  {row.item.name}
                </span>
              </li>
            ) : (
              <li key={`free-${row.start}`} className="tl-row tl-free">
                <span className="tl-time">{formatNightTime(row.start)}〜</span>
                <span className="tl-name">自由時間 {formatDuration(row.minutes)}</span>
              </li>
            ),
          )}
        </ul>
      )}

      <p className="tl-summary">
        自由時間 合計 {formatDuration(result.freeTotalMin)}・就寝{' '}
        {formatNightTime(plan.bedtime)}
      </p>
    </div>
  )
}
