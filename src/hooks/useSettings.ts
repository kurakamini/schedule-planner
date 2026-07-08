import { useCallback, useState } from 'react'
import type { Settings } from '../types'
import { loadSettings, saveSettings } from '../lib/storage'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  const update = useCallback((next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }, [])

  /** clearAllData 実行後などに localStorage から読み直す */
  const reload = useCallback(() => {
    setSettings(loadSettings())
  }, [])

  return { settings, update, reload }
}
