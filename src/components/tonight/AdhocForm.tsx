import { useState } from 'react'
import type { FormEvent } from 'react'
import { parseNightTime } from '../../lib/time'
import { parseDurationMin } from '../../lib/duration'
import type { AdhocInput } from '../../hooks/useScenePlan'

/** 今日だけのタスク追加フォーム(ルーチンには登録しない)。作成ビューと実行ビューで共用 */
export function AdhocForm({ onAdd }: { onAdd: (input: AdhocInput) => void }) {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('')
  const [fixedStart, setFixedStart] = useState('')

  const durationParsed = parseDurationMin(duration)
  const durationInvalid = durationParsed === null
  const wantsFixed = fixedStart.trim() !== ''
  const fixedParsed = wantsFixed ? parseNightTime(fixedStart) : undefined
  const fixedInvalid = wantsFixed && fixedParsed === null
  const canSubmit = name.trim() !== '' && !durationInvalid && !fixedInvalid

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || durationParsed === null) return
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
            時刻を読み取れません。2200 か 22:00 のように入力してください
          </p>
        )}
      </div>
      <button type="submit" disabled={!canSubmit}>
        追加
      </button>
    </form>
  )
}
