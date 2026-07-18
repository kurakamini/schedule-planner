import { useEffect, useState } from 'react'
import type { Scene, ScenePlan } from '../../types'
import { formatNightTime, parseNightTime } from '../../lib/time'
import type { AdhocInput } from '../../hooks/useScenePlan'
import { AdhocForm } from './AdhocForm'

type Props = {
  scene: Scene
  plan: ScenePlan
  onToggle: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  onAdd: (input: AdhocInput) => void
  /** undefined = 終了なし(入力欄が空) */
  onSetEndAt: (endAt: number | undefined) => void
  onSetAnchor: (anchorAt: number) => void
  onStart: () => void
}

export function PlanEditor({
  scene,
  plan,
  onToggle,
  onMove,
  onAdd,
  onSetEndAt,
  onSetAnchor,
  onStart,
}: Props) {
  // 開始時刻: 初期値は現在時刻(プラン新規作成時に設定済み)。
  // 再編集ではプランに保存された値がそのまま初期値になる
  const [anchorDraft, setAnchorDraft] = useState(() =>
    formatNightTime(plan.anchorAt),
  )
  const [endDraft, setEndDraft] = useState(() =>
    plan.endAt !== undefined ? formatNightTime(plan.endAt) : '',
  )

  // 画面復帰時の追従などフック側で anchorAt が変わった時に入力欄へ反映する。
  // 入力中(ドラフトが同じ値にパースされる時)は書き換えず、打ちかけを壊さない
  useEffect(() => {
    setAnchorDraft((draft) =>
      parseNightTime(draft) === plan.anchorAt
        ? draft
        : formatNightTime(plan.anchorAt),
    )
  }, [plan.anchorAt])

  const anchorParsed = parseNightTime(anchorDraft)
  // 終了時刻は空欄 = 終了なし(締切を決めず所要時間だけで組む)
  const endEmpty = endDraft.trim() === ''
  const endParsed = endEmpty ? null : parseNightTime(endDraft)
  const anchorInvalid = anchorParsed === null
  const endInvalid = !endEmpty && endParsed === null
  // 開始時刻が終了時刻以降だとスケジュールが成立しない(表示も矛盾する)ため弾く
  const orderInvalid =
    anchorParsed !== null && endParsed !== null && anchorParsed >= endParsed

  const items = [...plan.items].sort((a, b) => a.order - b.order)
  const includedCount = items.filter((it) => it.included).length

  function handleAnchorChange(value: string) {
    setAnchorDraft(value)
    const parsed = parseNightTime(value)
    if (parsed !== null) onSetAnchor(parsed)
  }

  function handleEndChange(value: string) {
    setEndDraft(value)
    if (value.trim() === '') {
      onSetEndAt(undefined) // 空欄 = 終了なし
      return
    }
    const parsed = parseNightTime(value)
    if (parsed !== null) onSetEndAt(parsed)
  }

  return (
    <section>
      <h2>{scene.name}のプラン</h2>

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
          <label htmlFor="plan-end">終了時刻</label>
          <input
            id="plan-end"
            className="time-input"
            inputMode="numeric"
            placeholder="なし"
            value={endDraft}
            onChange={(e) => handleEndChange(e.target.value)}
            onBlur={() => {
              if (endParsed !== null) {
                setEndDraft(formatNightTime(endParsed))
              }
            }}
          />
        </div>
      </div>
      <p className="hint">
        時刻は 2130 のようにコロンなしでも入力できます(深夜 0 時越えは 2430 =
        24:30)。終了時刻を空欄にすると締切なしで組みます
      </p>
      {anchorInvalid && (
        <p className="field-error" role="alert">
          開始時刻を読み取れません。2130 か 21:30 のように入力してください
        </p>
      )}
      {endInvalid && (
        <p className="field-error" role="alert">
          終了時刻を読み取れません。2430 か 24:30 のように入力してください
        </p>
      )}
      {orderInvalid && (
        <p className="field-error" role="alert">
          開始時刻は終了時刻より前にしてください
        </p>
      )}

      <h3>きょうやること</h3>
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
          includedCount === 0 || endInvalid || anchorInvalid || orderInvalid
        }
        onClick={onStart}
      >
        スケジュールを作成
      </button>
    </section>
  )
}
