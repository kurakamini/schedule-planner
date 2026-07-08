import { useState } from 'react'
import type { FormEvent } from 'react'
import type { TonightPlan } from '../../types'
import { formatNightTime, parseNightTime } from '../../lib/time'
import type { AdhocInput } from '../../hooks/useTonightPlan'

type Props = {
  plan: TonightPlan
  onToggle: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  onAdd: (input: AdhocInput) => void
  onSetBedtime: (bedtime: number) => void
  onStart: () => void
}

export function PlanEditor({
  plan,
  onToggle,
  onMove,
  onAdd,
  onSetBedtime,
  onStart,
}: Props) {
  const [bedtimeDraft, setBedtimeDraft] = useState(() =>
    formatNightTime(plan.bedtime),
  )
  const bedtimeParsed = parseNightTime(bedtimeDraft)
  const bedtimeInvalid = bedtimeParsed === null

  const items = [...plan.items].sort((a, b) => a.order - b.order)
  const includedCount = items.filter((it) => it.included).length

  function handleBedtimeChange(value: string) {
    setBedtimeDraft(value)
    const parsed = parseNightTime(value)
    if (parsed !== null) onSetBedtime(parsed)
  }

  return (
    <section>
      <h2>今夜のプラン</h2>

      <div className="field">
        <label htmlFor="plan-bedtime">就寝時刻(今夜)</label>
        <input
          id="plan-bedtime"
          className="time-input"
          inputMode="numeric"
          value={bedtimeDraft}
          onChange={(e) => handleBedtimeChange(e.target.value)}
          onBlur={() => {
            if (bedtimeParsed !== null) {
              setBedtimeDraft(formatNightTime(bedtimeParsed))
            }
          }}
        />
        {bedtimeInvalid && (
          <p className="field-error" role="alert">
            時刻を読み取れません。24:30 のように入力してください
          </p>
        )}
      </div>

      <h3>今夜やること</h3>
      {items.length === 0 ? (
        <p className="placeholder">
          タスクがありません。ルーチンタブで定番を登録するか、下から今日だけのタスクを追加してください。
        </p>
      ) : (
        <ul className="plan-list">
          {items.map((item, i) => (
            <li
              key={item.id}
              className={`plan-row${item.included ? '' : ' plan-excluded'}`}
            >
              <label className="plan-check">
                <input
                  type="checkbox"
                  checked={item.included}
                  onChange={() => onToggle(item.id)}
                />
                <span className="plan-info">
                  <span className="routine-name">{item.name}</span>
                  <span className="routine-meta">
                    {item.durationMin}分
                    {item.fixedStart !== undefined && (
                      <span className="badge">
                        📌 {formatNightTime(item.fixedStart)}
                      </span>
                    )}
                    {item.routineId === undefined && (
                      <span className="badge">今日だけ</span>
                    )}
                  </span>
                </span>
              </label>
              <div className="routine-actions">
                <button
                  type="button"
                  aria-label={`${item.name} を上へ`}
                  disabled={i === 0}
                  onClick={() => onMove(item.id, -1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`${item.name} を下へ`}
                  disabled={i === items.length - 1}
                  onClick={() => onMove(item.id, 1)}
                >
                  ▼
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AdhocForm onAdd={onAdd} />

      <button
        type="button"
        className="btn-primary btn-large"
        disabled={includedCount === 0 || bedtimeInvalid}
        onClick={onStart}
      >
        スケジュールを作成
      </button>
    </section>
  )
}

/** 今日だけのタスク追加フォーム(ルーチンには登録しない) */
function AdhocForm({ onAdd }: { onAdd: (input: AdhocInput) => void }) {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('')
  const [fixedStart, setFixedStart] = useState('')

  const durationParsed = /^\d{1,3}$/.test(duration.trim())
    ? Number(duration.trim())
    : null
  const durationInvalid = durationParsed === null || durationParsed < 1
  const wantsFixed = fixedStart.trim() !== ''
  const fixedParsed = wantsFixed ? parseNightTime(fixedStart) : undefined
  const fixedInvalid = wantsFixed && fixedParsed === null
  const canSubmit = name.trim() !== '' && !durationInvalid && !fixedInvalid

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onAdd({
      name: name.trim(),
      durationMin: durationParsed,
      fixedStart: fixedParsed ?? undefined,
    })
    setName('')
    setDuration('')
    setFixedStart('')
  }

  return (
    <form className="adhoc-form" onSubmit={handleSubmit}>
      <h3>今日だけのタスクを追加</h3>
      <div className="field">
        <label htmlFor="adhoc-name">タスク名</label>
        <input
          id="adhoc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="adhoc-duration">所要時間(分)</label>
        <input
          id="adhoc-duration"
          className="time-input"
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        {duration.trim() !== '' && durationInvalid && (
          <p className="field-error" role="alert">
            1〜999 の整数で入力してください
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="adhoc-fixed">固定開始時刻(任意)</label>
        <input
          id="adhoc-fixed"
          className="time-input"
          inputMode="numeric"
          placeholder="22:00"
          value={fixedStart}
          onChange={(e) => setFixedStart(e.target.value)}
        />
        {fixedInvalid && (
          <p className="field-error" role="alert">
            時刻を読み取れません。22:00 のように入力してください
          </p>
        )}
      </div>
      <button type="submit" disabled={!canSubmit}>
        追加
      </button>
    </form>
  )
}
