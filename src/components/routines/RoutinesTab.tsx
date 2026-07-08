import { useState } from 'react'
import type { FormEvent } from 'react'
import type { RoutineTask } from '../../types'
import { formatNightTime, parseNightTime } from '../../lib/time'
import { parseDurationMin } from '../../lib/duration'
import { useRoutines } from '../../hooks/useRoutines'

type FormState = { name: string; duration: string; fixedStart: string }

const EMPTY_FORM: FormState = { name: '', duration: '', fixedStart: '' }

export function RoutinesTab() {
  const { routines, add, update, remove, move } = useRoutines()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const duration = parseDurationMin(form.duration)
  const wantsFixed = form.fixedStart.trim() !== ''
  const fixedStart = wantsFixed ? parseNightTime(form.fixedStart) : undefined
  const nameInvalid = form.name.trim() === ''
  const durationInvalid = duration === null
  const fixedStartInvalid = wantsFixed && fixedStart === null
  const canSubmit = !nameInvalid && !durationInvalid && !fixedStartInvalid

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || duration === null) return
    const input = {
      name: form.name.trim(),
      durationMin: duration,
      fixedStart: fixedStart ?? undefined,
    }
    if (editingId) {
      update(editingId, input)
    } else {
      add(input)
    }
    resetForm()
  }

  function startEdit(r: RoutineTask) {
    setEditingId(r.id)
    setForm({
      name: r.name,
      duration: String(r.durationMin),
      fixedStart: r.fixedStart !== undefined ? formatNightTime(r.fixedStart) : '',
    })
  }

  function handleDelete(r: RoutineTask) {
    if (!window.confirm(`「${r.name}」を削除しますか?`)) return
    remove(r.id)
    if (editingId === r.id) resetForm()
  }

  return (
    <section>
      <h2>ルーチン</h2>
      <p className="hint">
        毎晩の定番タスク。プラン作成時にここから選択された状態で始まります
      </p>

      {routines.length === 0 ? (
        <p className="placeholder">
          まだルーチンがありません。下のフォームから登録してください。
        </p>
      ) : (
        <ul className="routine-list">
          {routines.map((r, i) => (
            <li key={r.id} className="routine-row">
              <div className="routine-main">
                <span className="routine-name">{r.name}</span>
                <span className="routine-meta">
                  {r.durationMin}分
                  {r.fixedStart !== undefined && (
                    <span className="badge">📌 {formatNightTime(r.fixedStart)}</span>
                  )}
                </span>
              </div>
              <div className="routine-actions">
                <button
                  type="button"
                  aria-label={`${r.name} を上へ`}
                  disabled={i === 0}
                  onClick={() => move(r.id, -1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`${r.name} を下へ`}
                  disabled={i === routines.length - 1}
                  onClick={() => move(r.id, 1)}
                >
                  ▼
                </button>
                <button
                  type="button"
                  aria-label={`${r.name} を編集`}
                  onClick={() => startEdit(r)}
                >
                  編集
                </button>
                <button
                  type="button"
                  aria-label={`${r.name} を削除`}
                  onClick={() => handleDelete(r)}
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="routine-form" onSubmit={handleSubmit}>
        <h3>{editingId ? 'ルーチンを編集' : 'ルーチンを追加'}</h3>
        <div className="field">
          <label htmlFor="routine-name">タスク名</label>
          <input
            id="routine-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="routine-duration">所要時間(分)</label>
          <input
            id="routine-duration"
            className="time-input"
            inputMode="numeric"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
          />
          {form.duration.trim() !== '' && durationInvalid && (
            <p className="field-error" role="alert">
              1〜999 の整数で入力してください
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="routine-fixed">固定開始時刻(任意)</label>
          <p className="hint">
            「22:00 から配信」のような時刻固定の予定だけ入力(2200
            のようにコロンなしでも可)。空欄なら順に配置
          </p>
          <input
            id="routine-fixed"
            className="time-input"
            inputMode="numeric"
            placeholder="22:00"
            value={form.fixedStart}
            onChange={(e) => setForm({ ...form, fixedStart: e.target.value })}
          />
          {fixedStartInvalid && (
            <p className="field-error" role="alert">
              時刻を読み取れません。2200 か 22:00 のように入力してください
            </p>
          )}
        </div>
        <div className="button-row">
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {editingId ? '更新' : '追加'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              キャンセル
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
