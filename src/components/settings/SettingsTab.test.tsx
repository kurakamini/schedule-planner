import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsTab } from './SettingsTab'
import {
  loadRoutines,
  loadScenePlan,
  loadScenes,
  saveCurrentSceneId,
  saveRoutines,
  saveScenes,
} from '../../lib/storage'

const NIGHT = { id: 'night', name: '夜', defaultEnd: 1470, order: 0 }

beforeEach(() => {
  localStorage.clear()
  saveScenes([NIGHT])
  saveCurrentSceneId(NIGHT.id)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function addScene(name: string, end: string) {
  fireEvent.change(screen.getByLabelText('名前'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('デフォルト終了時刻(任意)'), {
    target: { value: end },
  })
  fireEvent.click(screen.getByRole('button', { name: '追加' }))
}

describe('SettingsTab: シーン管理', () => {
  it('シーンを追加でき、保存にも反映される', () => {
    render(<SettingsTab />)
    addScene('朝', '8:00')

    expect(screen.getByText('朝')).toBeInTheDocument()
    expect(screen.getByText('終了 8:00')).toBeInTheDocument()
    expect(loadScenes()).toMatchObject([
      { name: '夜', defaultEnd: 1470, order: 0 },
      { name: '朝', defaultEnd: 480, order: 1 },
    ])
  })

  it('シーンの名前とデフォルト終了時刻を編集できる', () => {
    render(<SettingsTab />)
    fireEvent.click(screen.getByRole('button', { name: '夜 を編集' }))
    expect(screen.getByLabelText('名前')).toHaveValue('夜')
    expect(screen.getByLabelText('デフォルト終了時刻(任意)')).toHaveValue('24:30')

    fireEvent.change(screen.getByLabelText('デフォルト終了時刻(任意)'), {
      target: { value: '2500' }, // コロンなし入力
    })
    fireEvent.click(screen.getByRole('button', { name: '更新' }))

    expect(screen.getByText('終了 25:00')).toBeInTheDocument()
    expect(loadScenes()).toMatchObject([{ name: '夜', defaultEnd: 1500 }])
  })

  it('デフォルト終了時刻を空欄にすると終了なしシーンとして追加できる', () => {
    render(<SettingsTab />)
    fireEvent.change(screen.getByLabelText('名前'), {
      target: { value: '休日家事' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    expect(screen.getByText('終了 なし')).toBeInTheDocument()
    expect(loadScenes()).toMatchObject([
      { name: '夜', defaultEnd: 1470 },
      { name: '休日家事' },
    ])
    expect(loadScenes()[1].defaultEnd).toBeUndefined()
  })

  it('不正な時刻はエラーを表示し、追加ボタンが無効になる', () => {
    render(<SettingsTab />)
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '朝' } })
    fireEvent.change(screen.getByLabelText('デフォルト終了時刻(任意)'), {
      target: { value: 'abc' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/24:30 のように/)
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  it('シーン削除は確認を挟み、ルーチン・プランも一緒に消える', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    saveScenes([NIGHT, { id: 'morning', name: '朝', defaultEnd: 480, order: 1 }])
    saveRoutines('morning', [
      { id: 'm1', name: '朝食', durationMin: 10, order: 0 },
    ])
    render(<SettingsTab />)

    // キャンセルなら消えない
    fireEvent.click(screen.getByRole('button', { name: '朝 を削除' }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(loadScenes()).toHaveLength(2)

    // 実行するとシーンと配下データが消える
    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: '朝 を削除' }))
    expect(loadScenes()).toMatchObject([{ name: '夜' }])
    expect(loadRoutines('morning')).toEqual([])
    expect(loadScenePlan('morning')).toBeNull()
  })

  it('最後の 1 シーンは削除できない', () => {
    render(<SettingsTab />)
    expect(screen.getByRole('button', { name: '夜 を削除' })).toBeDisabled()
    expect(
      screen.getByText('最後の 1 シーンは削除できません'),
    ).toBeInTheDocument()
  })

  it('データ全消去は 2 段階確認で、実行すると初期シーンだけに戻る', () => {
    saveRoutines(NIGHT.id, [
      { id: 'r1', name: '夕食', durationMin: 30, order: 0 },
    ])
    render(<SettingsTab />)
    addScene('朝', '8:00')

    // 1 段階目: 確認表示が出るだけで、まだ消えない
    fireEvent.click(screen.getByRole('button', { name: 'データを全消去…' }))
    expect(screen.getByText(/すべて消えます/)).toBeInTheDocument()
    expect(loadRoutines(NIGHT.id)).toHaveLength(1)

    // 2 段階目: 実行で全消去され、初期シーン「夜」だけが作り直される
    fireEvent.click(screen.getByRole('button', { name: '全消去する' }))
    expect(loadRoutines(NIGHT.id)).toEqual([])
    const scenes = loadScenes()
    expect(scenes).toHaveLength(1)
    expect(scenes[0].name).toBe('夜')
    expect(scenes[0].defaultEnd).toBe(1470)
  })

  it('全消去の確認は「やめる」でキャンセルできる', () => {
    saveRoutines(NIGHT.id, [
      { id: 'r1', name: '夕食', durationMin: 30, order: 0 },
    ])
    render(<SettingsTab />)

    fireEvent.click(screen.getByRole('button', { name: 'データを全消去…' }))
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))
    expect(screen.queryByText(/すべて消えます/)).not.toBeInTheDocument()
    expect(loadRoutines(NIGHT.id)).toHaveLength(1)
  })
})
