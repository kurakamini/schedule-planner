import { useState } from 'react'
import { formatNightTime, parseNightTime } from '../../lib/time'
import { clearAllData } from '../../lib/storage'
import { useSettings } from '../../hooks/useSettings'

export function SettingsTab() {
  const { settings, update, reload } = useSettings()
  const [draft, setDraft] = useState(() =>
    formatNightTime(settings.defaultBedtime),
  )
  const [saved, setSaved] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)

  const parsed = parseNightTime(draft)
  const invalid = parsed === null

  function handleSave() {
    if (parsed === null) return
    update({ ...settings, defaultBedtime: parsed })
    setDraft(formatNightTime(parsed)) // "0:30" → "24:30" などの正規化を表示に反映
    setSaved(true)
  }

  function handleClearAll() {
    clearAllData()
    reload()
    setDraft(formatNightTime(1470))
    setSaved(false)
    setConfirmingClear(false)
  }

  return (
    <section>
      <h2>設定</h2>

      <div className="settings-section">
        <div className="field">
          <label htmlFor="default-bedtime">デフォルト就寝時刻</label>
          <p className="hint">
            コロンなし(2430)でも入力可。深夜 0 時を越える場合は 24:30、25:00
            の表記
          </p>
          <input
            id="default-bedtime"
            className="time-input"
            inputMode="numeric"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setSaved(false)
            }}
          />
          {invalid && (
            <p className="field-error" role="alert">
              時刻を読み取れません。2430 か 24:30 のように入力してください
            </p>
          )}
          {saved && <p className="feedback">保存しました</p>}
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={invalid}
          onClick={handleSave}
        >
          保存
        </button>
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
            <p>ルーチン・今夜のプラン・設定がすべて消えます。よろしいですか?</p>
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
