import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { TonightTab } from './TonightTab'
import {
  loadTonightPlan,
  saveRoutines,
  saveSettings,
  saveTonightPlan,
} from '../../lib/storage'
import type { RoutineTask, TonightPlan } from '../../types'

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
  it('ルーチン全件が選択済みで並び、開始時刻は現在時刻・就寝時刻はデフォルト値', () => {
    render(<TonightTab />)
    expect(
      screen.getByRole('heading', { name: '今夜のプラン' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('開始時刻')).toHaveValue('21:10')
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

  it('時間が過ぎてもタイムラインの時刻は動かず、終了予定の超過を知らせる', () => {
    renderStarted() // 21:10 開始
    vi.setSystemTime(new Date(2026, 6, 8, 21, 50))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    // 配置は開始時刻(21:10)起点のまま
    expect(tlRows()[0]).toBe('21:10〜21:40夕食')
    expect(nowCardTask()).toBe('夕食')
    expect(
      screen.getByText('終了予定 21:40 を過ぎています'),
    ).toBeInTheDocument()
  })

  it('開き直しても開始時刻がずれない(アンカー保持)', () => {
    const view = renderStarted() // 21:10 開始
    vi.setSystemTime(new Date(2026, 6, 8, 21, 25))
    view.unmount()
    render(<TonightTab />) // 21:25 に開き直す

    expect(tlRows()[0]).toBe('21:10〜21:40夕食')
    expect(screen.getByText('21:40 まで(残り 15分)')).toBeInTheDocument()
  })

  it('遅れて完了すると以降は完了時刻から引き直され、固定予定待ちは「次は◯◯から」', () => {
    renderStarted() // 21:10 開始
    vi.setSystemTime(new Date(2026, 6, 8, 21, 50))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    fireEvent.click(screen.getByRole('button', { name: '完了' })) // 夕食を 21:50 に完了

    // 風呂(30 分)は 22:00 の配信前に収まらない → 配信待ちになる
    expect(tlRows()[0]).toBe('21:50 完了夕食')
    expect(screen.getByText('次は 22:00 から')).toBeInTheDocument()
    expect(nowCardTask()).toBe('📌 配信')
    expect(screen.getByText('それまで自由時間 10分')).toBeInTheDocument()
  })

  it('開始時刻を入力して組め、再編集でも保持される(コロンなし入力対応)', () => {
    render(<TonightTab />)
    fireEvent.change(screen.getByLabelText('開始時刻'), {
      target: { value: '2130' }, // コロンなし入力
    })
    fireEvent.click(createButton())

    expect(tlRows()[0]).toBe('21:30〜22:00夕食')
    // 現在(21:10)より未来なので待ち表示になる
    expect(screen.getByText('次は 21:30 から')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'プランを編集' }))
    expect(screen.getByLabelText('開始時刻')).toHaveValue('21:30')
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

describe('TonightTab: 夜の切り替わり(F5)', () => {
  const lastNightPlan: TonightPlan = {
    nightKey: '2026-07-07',
    bedtime: 1470,
    started: true,
    anchorAt: 1270,
    items: [
      {
        id: 'i1',
        routineId: 'r1',
        name: '夕食',
        durationMin: 30,
        order: 0,
        included: true,
        done: true,
        doneAt: 1300,
      },
    ],
  }

  it('翌夜に開くと前夜のプラン(実行中でも)は破棄され、作成ビューから始まる', () => {
    saveTonightPlan(lastNightPlan) // 前夜(7/7)の実行中プラン。現在は 7/8 21:10
    render(<TonightTab />)

    expect(
      screen.getByRole('heading', { name: '今夜のプラン' }),
    ).toBeInTheDocument()
    // ルーチン全件が未完了・選択済みで作り直されている
    const checks = screen.getAllByRole('checkbox')
    expect(checks).toHaveLength(4)
    expect(loadTonightPlan()?.nightKey).toBe('2026-07-08')
  })

  it('深夜 0 時を過ぎても(朝 4 時まで)同じ夜としてプランを保持する', () => {
    saveTonightPlan({ ...lastNightPlan, nightKey: '2026-07-08' })
    vi.setSystemTime(new Date(2026, 6, 9, 1, 0)) // 翌 1:00 = 25:00

    render(<TonightTab />)
    expect(
      screen.getByRole('heading', { name: '今夜のスケジュール' }),
    ).toBeInTheDocument()
    expect(loadTonightPlan()?.nightKey).toBe('2026-07-08')
  })

  it('朝 4 時を過ぎると新しい夜になる', () => {
    saveTonightPlan({ ...lastNightPlan, nightKey: '2026-07-08' })
    vi.setSystemTime(new Date(2026, 6, 9, 4, 0)) // 朝 4:00

    render(<TonightTab />)
    expect(
      screen.getByRole('heading', { name: '今夜のプラン' }),
    ).toBeInTheDocument()
    expect(loadTonightPlan()?.nightKey).toBe('2026-07-09')
  })
})
