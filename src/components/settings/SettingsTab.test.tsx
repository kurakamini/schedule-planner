import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsTab } from './SettingsTab'
import { loadRoutines, loadSettings, saveRoutines } from '../../lib/storage'

beforeEach(() => {
  localStorage.clear()
})

const bedtimeInput = () =>
  screen.getByLabelText('デフォルト就寝時刻') as HTMLInputElement

describe('SettingsTab', () => {
  it('デフォルト就寝時刻を保存し、再マウント後も保持される', () => {
    const view = render(<SettingsTab />)
    expect(bedtimeInput()).toHaveValue('24:30') // 初期値

    fireEvent.change(bedtimeInput(), { target: { value: '25:00' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByText('保存しました')).toBeInTheDocument()
    view.unmount()

    render(<SettingsTab />)
    expect(bedtimeInput()).toHaveValue('25:00')
    expect(loadSettings()).toEqual({ defaultBedtime: 1500 })
  })

  it('0〜3 時台の入力は 24 時以降の表記に正規化して保存する', () => {
    render(<SettingsTab />)
    fireEvent.change(bedtimeInput(), { target: { value: '0:30' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(bedtimeInput()).toHaveValue('24:30')
    expect(loadSettings()).toEqual({ defaultBedtime: 1470 })
  })

  it('不正な時刻はエラーを表示し、保存ボタンが無効になる', () => {
    render(<SettingsTab />)
    fireEvent.change(bedtimeInput(), { target: { value: 'abc' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/24:30 のように/)
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  it('データ全消去は 2 段階確認で、実行すると初期値に戻る', () => {
    saveRoutines([{ id: 'r1', name: '夕食', durationMin: 30, order: 0 }])
    render(<SettingsTab />)
    fireEvent.change(bedtimeInput(), { target: { value: '25:00' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    // 1 段階目: 確認表示が出るだけで、まだ消えない
    fireEvent.click(screen.getByRole('button', { name: 'データを全消去…' }))
    expect(screen.getByText(/すべて消えます/)).toBeInTheDocument()
    expect(loadRoutines()).toHaveLength(1)

    // 2 段階目: 実行で全消去され、表示も初期値へ
    fireEvent.click(screen.getByRole('button', { name: '全消去する' }))
    expect(loadRoutines()).toEqual([])
    expect(localStorage.getItem('sp.v1.settings')).toBeNull()
    expect(bedtimeInput()).toHaveValue('24:30')
  })

  it('全消去の確認は「やめる」でキャンセルできる', () => {
    saveRoutines([{ id: 'r1', name: '夕食', durationMin: 30, order: 0 }])
    render(<SettingsTab />)

    fireEvent.click(screen.getByRole('button', { name: 'データを全消去…' }))
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))
    expect(screen.queryByText(/すべて消えます/)).not.toBeInTheDocument()
    expect(loadRoutines()).toHaveLength(1)
  })
})
