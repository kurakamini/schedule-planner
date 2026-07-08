import { useState } from 'react'
import './App.css'
import { RoutinesTab } from './components/routines/RoutinesTab'
import { SettingsTab } from './components/settings/SettingsTab'
import { TonightTab } from './components/tonight/TonightTab'

const TABS = [
  { key: 'tonight', label: '今夜' },
  { key: 'routines', label: 'ルーチン' },
  { key: 'settings', label: '設定' },
] as const

type TabKey = (typeof TABS)[number]['key']

function App() {
  const [tab, setTab] = useState<TabKey>('tonight')

  return (
    <div className="app">
      <header className="app-header">
        <h1>スケジュール計画立案</h1>
      </header>
      <main className="app-content">
        {tab === 'tonight' && <TonightTab />}
        {tab === 'routines' && <RoutinesTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
      <nav className="tab-bar" aria-label="メインタブ">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={tab === t.key ? 'page' : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
