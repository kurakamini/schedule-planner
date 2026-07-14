import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RoutinesTab } from './RoutinesTab'
import {
  loadRoutines,
  saveCurrentSceneId,
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

function addRoutine(name: string, duration: string, fixedStart = '') {
  fireEvent.change(screen.getByLabelText('タスク名'), {
    target: { value: name },
  })
  fireEvent.change(screen.getByLabelText('所要時間(分)'), {
    target: { value: duration },
  })
  fireEvent.change(screen.getByLabelText('固定開始時刻(任意)'), {
    target: { value: fixedStart },
  })
  fireEvent.click(screen.getByRole('button', { name: '追加' }))
}

const rowNames = () =>
  screen.getAllByRole('listitem').map(
    (li) => li.querySelector('.routine-name')?.textContent,
  )

describe('RoutinesTab', () => {
  it('ルーチンを追加でき、再マウント後も保持される', () => {
    const view = render(<RoutinesTab />)
    addRoutine('夕食', '30')
    expect(rowNames()).toEqual(['夕食'])
    view.unmount()

    render(<RoutinesTab />)
    expect(rowNames()).toEqual(['夕食'])
    expect(loadRoutines(NIGHT.id)).toMatchObject([
      { name: '夕食', durationMin: 30, order: 0 },
    ])
  })

  it('固定時刻付きで追加するとバッジが表示される', () => {
    render(<RoutinesTab />)
    addRoutine('配信', '30', '22:00')
    expect(screen.getByText('📌 22:00')).toBeInTheDocument()
    expect(loadRoutines(NIGHT.id)[0].fixedStart).toBe(1320)
  })

  it('タスク名が空・時刻が不正なら追加できない', () => {
    render(<RoutinesTab />)
    // 名前が空
    fireEvent.change(screen.getByLabelText('所要時間(分)'), {
      target: { value: '30' },
    })
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()

    // 固定時刻が不正
    fireEvent.change(screen.getByLabelText('タスク名'), {
      target: { value: '配信' },
    })
    fireEvent.change(screen.getByLabelText('固定開始時刻(任意)'), {
      target: { value: 'abc' },
    })
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(/時刻を読み取れません/)
  })

  it('▲▼で並べ替えでき、保存にも反映される', () => {
    render(<RoutinesTab />)
    addRoutine('夕食', '30')
    addRoutine('風呂', '30')
    addRoutine('英語', '30')
    expect(rowNames()).toEqual(['夕食', '風呂', '英語'])

    fireEvent.click(screen.getByRole('button', { name: '英語 を上へ' }))
    expect(rowNames()).toEqual(['夕食', '英語', '風呂'])

    fireEvent.click(screen.getByRole('button', { name: '夕食 を下へ' }))
    expect(rowNames()).toEqual(['英語', '夕食', '風呂'])

    expect(loadRoutines(NIGHT.id).map((r) => [r.name, r.order])).toEqual([
      ['英語', 0],
      ['夕食', 1],
      ['風呂', 2],
    ])

    // 端の項目は動かせない
    expect(screen.getByRole('button', { name: '英語 を上へ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '風呂 を下へ' })).toBeDisabled()
  })

  it('削除は確認ダイアログを挟み、キャンセルなら消えない', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<RoutinesTab />)
    addRoutine('夕食', '30')

    fireEvent.click(screen.getByRole('button', { name: '夕食 を削除' }))
    expect(confirmSpy).toHaveBeenCalledWith('「夕食」を削除しますか?')
    expect(rowNames()).toEqual(['夕食'])

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: '夕食 を削除' }))
    expect(loadRoutines(NIGHT.id)).toEqual([])
  })

  it('編集でき、更新後はフォームが追加モードに戻る', () => {
    render(<RoutinesTab />)
    addRoutine('英語', '30')

    fireEvent.click(screen.getByRole('button', { name: '英語 を編集' }))
    expect(screen.getByLabelText('タスク名')).toHaveValue('英語')
    expect(screen.getByLabelText('所要時間(分)')).toHaveValue('30')

    fireEvent.change(screen.getByLabelText('所要時間(分)'), {
      target: { value: '45' },
    })
    fireEvent.click(screen.getByRole('button', { name: '更新' }))

    expect(screen.getByText('45分')).toBeInTheDocument()
    expect(loadRoutines(NIGHT.id)).toMatchObject([
      { name: '英語', durationMin: 45 },
    ])
    // フォームは追加モードへ戻り、入力もクリアされる
    expect(screen.getByRole('button', { name: '追加' })).toBeInTheDocument()
    expect(screen.getByLabelText('タスク名')).toHaveValue('')
  })

  it('編集で固定時刻を外せる', () => {
    render(<RoutinesTab />)
    addRoutine('配信', '30', '22:00')

    fireEvent.click(screen.getByRole('button', { name: '配信 を編集' }))
    expect(screen.getByLabelText('固定開始時刻(任意)')).toHaveValue('22:00')
    fireEvent.change(screen.getByLabelText('固定開始時刻(任意)'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: '更新' }))

    expect(screen.queryByText(/📌/)).not.toBeInTheDocument()
    expect(loadRoutines(NIGHT.id)[0].fixedStart).toBeUndefined()
  })

  it('ルーチンはシーンごとに別管理される', () => {
    saveScenes([NIGHT, { id: 'morning', name: '朝', defaultEnd: 480, order: 1 }])
    render(<RoutinesTab />)
    addRoutine('夕食', '30')
    expect(rowNames()).toEqual(['夕食'])

    // 朝に切り替えると空。朝に追加しても夜には影響しない
    fireEvent.click(screen.getByRole('button', { name: '朝' }))
    expect(
      screen.getByRole('heading', { name: '朝のルーチン' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/まだルーチンがありません/)).toBeInTheDocument()

    addRoutine('朝食', '10')
    expect(rowNames()).toEqual(['朝食'])
    expect(loadRoutines(NIGHT.id)).toMatchObject([{ name: '夕食' }])
    expect(loadRoutines('morning')).toMatchObject([{ name: '朝食' }])
  })
})
