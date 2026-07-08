import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { TonightTab } from './TonightTab'
import { loadTonightPlan, saveRoutines, saveSettings } from '../../lib/storage'
import type { RoutineTask } from '../../types'

// requirements.md の具体例に合わせたルーチン(21:10 帰宅・就寝 24:30)
const ROUTINES: RoutineTask[] = [
  { id: 'r1', name: '夕食', durationMin: 30, order: 0 },
  { id: 'r2', name: '風呂', durationMin: 30, order: 1 },
  { id: 'r3', name: '英語', durationMin: 30, order: 2 },
  { id: 'r4', name: '配信', durationMin: 30, fixedStart: 1320, order: 3 },
]

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 8, 21, 10))
  saveRoutines(ROUTINES)
  saveSettings({ defaultBedtime: 1470 })
})

afterEach(() => {
  vi.useRealTimers()
})

const createButton = () =>
  screen.getByRole('button', { name: 'スケジュールを作成' })

/** タイムライン行を「時刻+名前」の文字列にする(チェックボックス等は除く) */
const tlRows = () =>
  [...document.querySelectorAll('.tl-row')].map(
    (li) =>
      `${li.querySelector('.tl-time')?.textContent}${li.querySelector('.tl-name')?.textContent}`,
  )

const nowCardTask = () =>
  document.querySelector('.now-card .now-task')?.textContent

describe('TonightTab: プラン作成ビュー', () => {
  it('ルーチン全件が選択済みで並び、就寝時刻はデフォルト値', () => {
    render(<TonightTab />)
    expect(
      screen.getByRole('heading', { name: '今夜のプラン' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('就寝時刻(今夜)')).toHaveValue('24:30')

    const checks = screen.getAllByRole('checkbox')
    expect(checks).toHaveLength(4)
    for (const c of checks) expect(c).toBeChecked()
  })

  it('作成すると requirements.md の具体例どおりのタイムラインが表示される', () => {
    const view = render(<TonightTab />)
    fireEvent.click(createButton())

    expect(
      screen.getByRole('heading', { name: '今夜のスケジュール' }),
    ).toBeInTheDocument()
    expect(tlRows()).toEqual([
      '21:10〜21:40夕食',
      '21:40〜自由時間 20分',
      '22:00〜22:30📌 配信',
      '22:30〜23:00風呂',
      '23:00〜23:30英語',
      '23:30〜自由時間 1時間',
    ])
    expect(screen.getByText(/自由時間 合計 1時間20分/)).toBeInTheDocument()

    // リロード相当(再マウント)でも実行ビューのまま
    view.unmount()
    render(<TonightTab />)
    expect(
      screen.getByRole('heading', { name: '今夜のスケジュール' }),
    ).toBeInTheDocument()
  })

  it('チェックを外したタスクはタイムラインに含まれない', () => {
    render(<TonightTab />)
    fireEvent.click(screen.getByRole('checkbox', { name: /風呂/ }))
    fireEvent.click(createButton())
    expect(tlRows().join('')).not.toContain('風呂')
  })

  it('今日だけのタスクを追加でき、タイムラインに含まれる', () => {
    render(<TonightTab />)
    fireEvent.change(screen.getByLabelText('タスク名'), {
      target: { value: 'ストレッチ' },
    })
    fireEvent.change(screen.getByLabelText('所要時間(分)'), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(screen.getByText('今日だけ')).toBeInTheDocument()

    fireEvent.click(createButton())
    expect(tlRows().join('')).toContain('ストレッチ')
  })

  it('▲▼の並べ替えが配置順に反映される', () => {
    render(<TonightTab />)
    fireEvent.click(screen.getByRole('button', { name: '英語 を上へ' }))
    fireEvent.click(createButton())

    const rows = tlRows()
    expect(rows[3]).toBe('22:30〜23:00英語')
    expect(rows[4]).toBe('23:00〜23:30風呂')
  })

  it('就寝時刻を早めて収まらないと警告と超過表示が出る', () => {
    const { container } = render(<TonightTab />)
    fireEvent.change(screen.getByLabelText('就寝時刻(今夜)'), {
      target: { value: '22:30' },
    })
    fireEvent.click(createButton())

    expect(screen.getByRole('alert')).toHaveTextContent(/収まりません/)
    expect(container.querySelectorAll('.tl-overflow')).toHaveLength(2) // 風呂・英語
  })

  it('「プランを編集」で作成ビューに戻り、選択状態は保持される', () => {
    render(<TonightTab />)
    fireEvent.click(screen.getByRole('checkbox', { name: /風呂/ }))
    fireEvent.click(createButton())
    fireEvent.click(screen.getByRole('button', { name: 'プランを編集' }))

    expect(
      screen.getByRole('heading', { name: '今夜のプラン' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /風呂/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /夕食/ })).toBeChecked()
  })

  it('あとから登録したルーチンが作成ビューに取り込まれる(当夜の調整は保持)', () => {
    const view = render(<TonightTab />)
    fireEvent.click(screen.getByRole('checkbox', { name: /風呂/ })) // 保存を発生させる
    view.unmount()

    saveRoutines([
      ...ROUTINES,
      { id: 'r5', name: '筋トレ', durationMin: 20, order: 4 },
    ])
    render(<TonightTab />)

    expect(screen.getByRole('checkbox', { name: /筋トレ/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /風呂/ })).not.toBeChecked()
    expect(loadTonightPlan()?.items).toHaveLength(5)
  })
})

describe('TonightTab: 実行ビュー', () => {
  function renderStarted() {
    const view = render(<TonightTab />)
    fireEvent.click(createButton())
    return view
  }

  it('NOW カードに最初のタスクと終了予定が出る', () => {
    renderStarted()
    expect(screen.getByText('いまやる')).toBeInTheDocument()
    expect(nowCardTask()).toBe('夕食')
    expect(screen.getByText('21:40 まで(残り 30分)')).toBeInTheDocument()
    expect(screen.getByText(/就寝まで 3時間20分/)).toBeInTheDocument()
  })

  it('完了すると完了行がグレー表示になり、残りが現在時刻から引き直される', () => {
    renderStarted()
    fireEvent.click(screen.getByRole('button', { name: '完了' }))

    // 夕食は完了行(21:10 完了)へ、NOW は風呂に繰り上がり 21:10 から再配置
    expect(tlRows()[0]).toBe('21:10 完了夕食')
    expect(nowCardTask()).toBe('風呂')
    expect(tlRows()).toEqual([
      '21:10 完了夕食',
      '21:10〜21:40風呂',
      '21:40〜自由時間 20分',
      '22:00〜22:30📌 配信',
      '22:30〜23:00英語',
      '23:00〜自由時間 1時間30分',
    ])
    // 保存にも反映
    expect(
      loadTonightPlan()?.items.find((it) => it.name === '夕食')?.done,
    ).toBe(true)
  })

  it('誤チェックは完了の取り消しで元に戻る', () => {
    renderStarted()
    fireEvent.click(screen.getByRole('button', { name: '完了' }))
    fireEvent.click(
      screen.getByRole('checkbox', { name: '夕食 の完了を取り消す' }),
    )
    expect(nowCardTask()).toBe('夕食')
    expect(
      loadTonightPlan()?.items.find((it) => it.name === '夕食')?.done,
    ).toBe(false)
  })

  it('行の「外す」でタスクを除外でき、編集ビューではチェックが外れている', () => {
    renderStarted()
    fireEvent.click(screen.getByRole('button', { name: '英語 を外す' }))
    expect(tlRows().join('')).not.toContain('英語')

    fireEvent.click(screen.getByRole('button', { name: 'プランを編集' }))
    expect(screen.getByRole('checkbox', { name: /英語/ })).not.toBeChecked()
  })

  it('実行ビューからタスクを追加できる', () => {
    renderStarted()
    fireEvent.change(screen.getByLabelText('タスク名'), {
      target: { value: 'ストレッチ' },
    })
    fireEvent.change(screen.getByLabelText('所要時間(分)'), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(tlRows().join('')).toContain('ストレッチ')
  })

  it('固定予定の前の空き時間は「次は◯◯から」と案内する', () => {
    renderStarted()
    // 21:50 まで進める: 夕食(30 分)は 22:00 の配信前に収まらない
    vi.setSystemTime(new Date(2026, 6, 8, 21, 50))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(screen.getByText('次は 22:00 から')).toBeInTheDocument()
    expect(nowCardTask()).toBe('📌 配信')
    expect(screen.getByText('それまで自由時間 10分')).toBeInTheDocument()
  })

  it('全タスク完了でご褒美画面になる', () => {
    renderStarted()
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: '完了' }))
    }
    expect(
      screen.getByText('おつかれさま!全部終わりました'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/就寝まで自由時間 3時間20分。堂々とどうぞ/),
    ).toBeInTheDocument()
    // NOW カードは消える
    expect(document.querySelector('.now-card')).toBeNull()
  })
})
