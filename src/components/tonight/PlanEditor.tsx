import { useState } from 'react'
import type { TonightPlan } from '../../types'
import { formatNightTime, parseNightTime } from '../../lib/time'
import type { AdhocInput } from '../../hooks/useTonightPlan'
import { AdhocForm } from './AdhocForm'

type Props = {
  plan: TonightPlan
  onToggle: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  onAdd: (input: AdhocInput) => void
  onSetBedtime: (bedtime: number) => void
  onSetAnchor: (anchorAt: number) => void
  onStart: () => void
}

export function PlanEditor({
  plan,
  onToggle,
  onMove,
  onAdd,
  onSetBedtime,
  onSetAnchor,
  onStart,
}: Props) {
  // 開始時刻: 初期値は現在時刻(プラン新規作成時に設定済み)。
  // 再編集ではプランに保存された値がそのまま初期値になる
  const [anchorDraft, setAnchorDraft] = useState(() =>
    formatNightTime(plan.anchorAt),
  )
  const [bedtimeDraft, setBedtimeDraft] = useState(() =>
    formatNightTime(plan.bedtime),
  )
  const anchorParsed = parseNightTime(anchorDraft)
  const bedtimeParsed = parseNightTime(bedtimeDraft)
  const anchorInvalid = anchorParsed === null
  const bedtimeInvalid = bedtimeParsed === null
  // 開始時刻が就寝時刻以降だとスケジュールが成立しない(表示も矛盾する)ため弾く
  const orderInvalid =
    anchorParsed !== null &&
    bedtimeParsed !== null &&
    anchorParsed >= bedtimeParsed

  const items = [...plan.items].sort((a, b) => a.order - b.order)
  const includedCount = items.filter((it) => it.included).length

  function handleAnchorChange(value: string) {
    setAnchorDraft(value)
    const parsed = parseNightTime(value)
    if (parsed !== null) onSetAnchor(parsed)
  }

  function handleBedtimeChange(value: string) {
    setBedtimeDraft(value)
    const parsed = parseNightTime(value)
    if (parsed !== null) onSetBedtime(parsed)
  }

  return (
    <section>
      <h2>今夜のプラン</h2>

      <div className="time-row">
        <div className="field">
          <label htmlFor="plan-anchor">開始時刻</label>
          <input
            id="plan-anchor"
            className="time-input"
            inputMode="numeric"
            value={anchorDraft}
            onChange={(e) => handleAnchorChange(e.target.value)}
            onBlur={() => {
              if (anchorParsed !== null) {
                setAnchorDraft(formatNightTime(anchorParsed))
              }
            }}
          />
        </div>
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
        </div>
      </div>
      <p className="hint">
        時刻は 2130 のようにコロンなしでも入力できます(深夜 0 時越えは 2430 =
        24:30)
      </p>
      {anchorInvalid && (
        <p className="field-error" role="alert">
          開始時刻を読み取れません。2130 か 21:30 のように入力してください
        </p>
      )}
      {bedtimeInvalid && (
        <p className="field-error" role="alert">
          就寝時刻を読み取れません。2430 か 24:30 のように入力してください
        </p>
      )}
      {orderInvalid && (
        <p className="field-error" role="alert">
          開始時刻は就寝時刻より前にしてください
        </p>
      )}

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

      <div className="adhoc-section">
        <h3>今日だけのタスクを追加</h3>
        <AdhocForm onAdd={onAdd} />
      </div>

      <button
        type="button"
        className="btn-primary btn-large"
        disabled={
          includedCount === 0 || bedtimeInvalid || anchorInvalid || orderInvalid
        }
        onClick={onStart}
      >
        スケジュールを作成
      </button>
    </section>
  )
}
