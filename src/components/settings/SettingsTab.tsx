import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Scene } from '../../types'
import { formatNightTime, parseNightTime } from '../../lib/time'
import { clearAllData } from '../../lib/storage'
import { useScenes } from '../../hooks/useScenes'

type FormState = { name: string; end: string }

const EMPTY_FORM: FormState = { name: '', end: '' }

export function SettingsTab() {
  const { scenes, addScene, updateScene, removeScene, reload } = useScenes()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [confirmingClear, setConfirmingClear] = useState(false)

  // デフォルト終了時刻は空欄 = 終了なし(所要時間だけで組むシーン)
  const endEmpty = form.end.trim() === ''
  const end = endEmpty ? null : parseNightTime(form.end)
  const nameInvalid = form.name.trim() === ''
  const endInvalid = !endEmpty && end === null
  const canSubmit = !nameInvalid && !endInvalid

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const input = { name: form.name.trim(), defaultEnd: end ?? undefined }
    if (editingId) {
      updateScene(editingId, input)
    } else {
      addScene(input)
    }
    resetForm()
  }

  function startEdit(s: Scene) {
    setEditingId(s.id)
    setForm({
      name: s.name,
      end: s.defaultEnd !== undefined ? formatNightTime(s.defaultEnd) : '',
    })
  }

  function handleDelete(s: Scene) {
    if (
      !window.confirm(
        `シーン「${s.name}」を削除しますか?このシーンのルーチンときょうのプランも消えます。`,
      )
    ) {
      return
    }
    removeScene(s.id)
    if (editingId === s.id) resetForm()
  }

  function handleClearAll() {
    clearAllData()
    reload()
    resetForm()
    setConfirmingClear(false)
  }

  return (
    <section>
      <h2>設定</h2>

      <div className="settings-section">
        <h3>シーン</h3>
        <p className="hint">
          夜・朝・休日など、スケジュールを立てる時間帯の区分。ルーチンとプランはシーンごとに分かれます
        </p>
        <ul className="routine-list">
          {scenes.map((s) => (
            <li key={s.id} className="routine-row">
              <div className="routine-main">
                <span className="routine-name">{s.name}</span>
                <span className="routine-meta">
                  終了{' '}
                  {s.defaultEnd !== undefined
                    ? formatNightTime(s.defaultEnd)
                    : 'なし'}
                </span>
              </div>
              <div className="routine-actions">
                <button
                  type="button"
                  aria-label={`${s.name} を編集`}
                  onClick={() => startEdit(s)}
                >
                  編集
                </button>
                <button
                  type="button"
                  aria-label={`${s.name} を削除`}
                  disabled={scenes.length <= 1}
                  onClick={() => handleDelete(s)}
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
        {scenes.length <= 1 && (
          <p className="hint">最後の 1 シーンは削除できません</p>
        )}

        <form className="routine-form" onSubmit={handleSubmit}>
          <h3>{editingId ? 'シーンを編集' : 'シーンを追加'}</h3>
          <div className="field">
            <label htmlFor="scene-name">名前</label>
            <input
              id="scene-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="朝"
            />
          </div>
          <div className="field">
            <label htmlFor="scene-end">デフォルト終了時刻(任意)</label>
            <p className="hint">
              夜なら就寝、朝なら出発の時刻。コロンなし(2430)でも入力可。深夜 0
              時越えは 24:30、25:00 の表記。空欄にすると締切なし
              (休日の家事など、所要時間だけで組むシーン向け)
            </p>
            <input
              id="scene-end"
              className="time-input"
              inputMode="numeric"
              placeholder="なし"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
            {form.end.trim() !== '' && endInvalid && (
              <p className="field-error" role="alert">
                時刻を読み取れません。2430 か 24:30 のように入力してください
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
      </div>

      <div className="settings-section">
        <h3>データ</h3>
        {!confirmingClear ? (
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => setConfirmingClear(true)}
          >
            データを全消去…
          </button>
        ) : (
          <div className="confirm-clear" role="alert">
            <p>
              シーン・ルーチン・きょうのプランがすべて消えます。よろしいですか?
            </p>
            <div className="button-row">
              <button
                type="button"
                className="btn-danger"
                onClick={handleClearAll}
              >
                全消去する
              </button>
              <button type="button" onClick={() => setConfirmingClear(false)}>
                やめる
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
