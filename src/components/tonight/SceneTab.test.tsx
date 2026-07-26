import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { SceneTab } from './SceneTab'
import {
  loadScenePlan,
  saveCurrentSceneId,
  saveRoutines,
  saveRules,
  saveScenePlan,
  saveScenes,
} from '../../lib/storage'
import type { RoutineTask, ScenePlan } from '../../types'

const NIGHT = { id: 'night', name: '夜', defaultEnd: 1470, order: 0 }

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
  saveScenes([NIGHT])
  saveCurrentSceneId(NIGHT.id)
  saveRoutines(NIGHT.id, ROUTINES)
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

const mascotText = () => document.querySelector('.mascot-bubble')?.textContent

describe('SceneTab: プラン作成ビュー', () => {
  it('ルーチン全件が選択済みで並び、開始時刻は現在時刻・終了時刻はシーンのデフォルト値', () => {
    render(<SceneTab />)
    expect(
      screen.getByRole('heading', { name: '夜のプラン' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('開始時刻')).toHaveValue('21:10')
    expect(screen.getByLabelText('終了時刻')).toHaveValue('24:30')

    const checks = screen.getAllByRole('checkbox')
    expect(checks).toHaveLength(4)
    for (const c of checks) expect(c).toBeChecked()
  })

  it('作成すると requirements.md の具体例どおりのタイムラインが表示される', () => {
    const view = render(<SceneTab />)
    fireEvent.click(createButton())

    expect(
      screen.getByRole('heading', { name: '夜のスケジュール' }),
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
    render(<SceneTab />)
    expect(
      screen.getByRole('heading', { name: '夜のスケジュール' }),
    ).toBeInTheDocument()
  })

  it('チェックを外したタスクはタイムラインに含まれない', () => {
    render(<SceneTab />)
    fireEvent.click(screen.getByRole('checkbox', { name: /風呂/ }))
    fireEvent.click(createButton())
    expect(tlRows().join('')).not.toContain('風呂')
  })

  it('今日だけのタスクを追加でき、タイムラインに含まれる', () => {
    render(<SceneTab />)
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
    render(<SceneTab />)
    fireEvent.click(screen.getByRole('button', { name: '英語 を上へ' }))
    fireEvent.click(createButton())

    const rows = tlRows()
    expect(rows[3]).toBe('22:30〜23:00英語')
    expect(rows[4]).toBe('23:00〜23:30風呂')
  })

  it('終了時刻を早めて収まらないと警告と超過表示が出る', () => {
    const { container } = render(<SceneTab />)
    fireEvent.change(screen.getByLabelText('終了時刻'), {
      target: { value: '22:30' },
    })
    fireEvent.click(createButton())

    expect(screen.getByRole('alert')).toHaveTextContent(/収まりません/)
    expect(container.querySelectorAll('.tl-overflow')).toHaveLength(2) // 風呂・英語
  })

  it('開始時刻が終了時刻以降だと作成できず、理由が表示される', () => {
    render(<SceneTab />)
    // 開始 25:00 > 終了 24:30 の逆転(コロンなし入力)
    fireEvent.change(screen.getByLabelText('開始時刻'), {
      target: { value: '2500' },
    })
    expect(
      screen.getByText('開始時刻は終了時刻より前にしてください'),
    ).toBeInTheDocument()
    expect(createButton()).toBeDisabled()

    // 開始を終了より前に戻せば作成できる
    fireEvent.change(screen.getByLabelText('開始時刻'), {
      target: { value: '2300' },
    })
    expect(
      screen.queryByText('開始時刻は終了時刻より前にしてください'),
    ).not.toBeInTheDocument()
    expect(createButton()).not.toBeDisabled()
  })

  it('「プランを編集」で作成ビューに戻り、選択状態は保持される', () => {
    render(<SceneTab />)
    fireEvent.click(screen.getByRole('checkbox', { name: /風呂/ }))
    fireEvent.click(createButton())
    fireEvent.click(screen.getByRole('button', { name: 'プランを編集' }))

    expect(
      screen.getByRole('heading', { name: '夜のプラン' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /風呂/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /夕食/ })).toBeChecked()
  })

  it('作成ビューのまま開き直すと、過去になった開始時刻は現在時刻へ追従する', () => {
    const view = render(<SceneTab />) // 21:10 に開いた
    fireEvent.click(screen.getByRole('checkbox', { name: /風呂/ })) // 調整を保存
    view.unmount()

    vi.setSystemTime(new Date(2026, 6, 8, 22, 0))
    render(<SceneTab />) // 22:00 に開き直す

    expect(screen.getByLabelText('開始時刻')).toHaveValue('22:00')
    // 当日の調整(チェック状態)は保持される
    expect(screen.getByRole('checkbox', { name: /風呂/ })).not.toBeChecked()
  })

  it('未来に設定した開始時刻は開き直しても保持される(開始前の仕込み)', () => {
    const view = render(<SceneTab />)
    fireEvent.change(screen.getByLabelText('開始時刻'), {
      target: { value: '2300' },
    })
    view.unmount()

    vi.setSystemTime(new Date(2026, 6, 8, 21, 30))
    render(<SceneTab />) // まだ 23:00 より前

    expect(screen.getByLabelText('開始時刻')).toHaveValue('23:00')
  })

  it('リロードなしで画面に戻ってきた時も開始時刻が追従する', () => {
    render(<SceneTab />) // 21:10 に開いた
    vi.setSystemTime(new Date(2026, 6, 8, 21, 45))
    fireEvent(document, new Event('visibilitychange')) // 21:45 に画面復帰

    expect(screen.getByLabelText('開始時刻')).toHaveValue('21:45')
    expect(loadScenePlan(NIGHT.id)?.anchorAt).toBe(21 * 60 + 45)
  })

  it('あとから登録したルーチンが作成ビューに取り込まれる(当日の調整は保持)', () => {
    const view = render(<SceneTab />)
    fireEvent.click(screen.getByRole('checkbox', { name: /風呂/ })) // 保存を発生させる
    view.unmount()

    saveRoutines(NIGHT.id, [
      ...ROUTINES,
      { id: 'r5', name: '筋トレ', durationMin: 20, order: 4 },
    ])
    render(<SceneTab />)

    expect(screen.getByRole('checkbox', { name: /筋トレ/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /風呂/ })).not.toBeChecked()
    expect(loadScenePlan(NIGHT.id)?.items).toHaveLength(5)
  })
})

describe('SceneTab: 実行ビュー', () => {
  function renderStarted() {
    const view = render(<SceneTab />)
    fireEvent.click(createButton())
    return view
  }

  it('NOW カードに最初のタスクと終了予定が出る', () => {
    renderStarted()
    expect(screen.getByText('いまやる')).toBeInTheDocument()
    expect(nowCardTask()).toBe('夕食')
    expect(screen.getByText('21:40 まで(残り 30分)')).toBeInTheDocument()
    expect(screen.getByText(/終了まで 3時間20分/)).toBeInTheDocument()
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
      loadScenePlan(NIGHT.id)?.items.find((it) => it.name === '夕食')?.done,
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
      loadScenePlan(NIGHT.id)?.items.find((it) => it.name === '夕食')?.done,
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
    render(<SceneTab />) // 21:25 に開き直す

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
    render(<SceneTab />)
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

  it('予定より早く完了した瞬間、行と全体の予定比が緑のマイナスになる', () => {
    renderStarted() // 21:10 開始。夕食の予定終了 21:40
    expect(screen.getByText('±0分')).toHaveClass('delta-even') // 開始直後は同着
    vi.setSystemTime(new Date(2026, 6, 8, 21, 30))
    fireEvent.click(screen.getByRole('button', { name: '完了' }))

    // 夕食: 予定 21:40 → 実績 21:30 = -10分。全体(スプリット差)も -10分
    // (📌 配信 22:00 が後ろに控えていても、待ち時間に吸収されずマイナスが出る)
    const deltas = screen.getAllByText('-10分')
    expect(deltas).toHaveLength(2)
    for (const d of deltas) expect(d).toHaveClass('delta-ahead')
  })

  it('予定より遅れて完了すると赤のプラスで予定比が出る', () => {
    renderStarted() // 21:10 開始
    vi.setSystemTime(new Date(2026, 6, 8, 21, 50))
    fireEvent.click(screen.getByRole('button', { name: '完了' }))

    // 夕食: 予定 21:40 → 実績 21:50 = +10分。全体(スプリット差)も +10分
    const deltas = screen.getAllByText('+10分')
    expect(deltas).toHaveLength(2)
    for (const d of deltas) expect(d).toHaveClass('delta-behind')
  })

  it('全タスク完了後は最後の完了時点の予定比が残る', () => {
    renderStarted() // 21:10 開始
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: '完了' }))
    }
    vi.setSystemTime(new Date(2026, 6, 8, 21, 20))
    fireEvent.click(screen.getByRole('button', { name: '完了' })) // 最後は配信(予定終了 22:30)

    // 最後の完了 21:20 − 予定 22:30 = -1時間10分(ヘッダの全体と配信の行の 2 箇所)
    const deltas = screen.getAllByText('-1時間10分')
    expect(deltas).toHaveLength(2)
    for (const d of deltas) expect(d).toHaveClass('delta-ahead')
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
      screen.getByText(/終了まで自由時間 3時間20分。堂々とどうぞ/),
    ).toBeInTheDocument()
    // NOW カードは消える
    expect(document.querySelector('.now-card')).toBeNull()
  })

  it('ミニキャラはスケジュール作成後だけ出て、いまやることをしゃべる', () => {
    render(<SceneTab />)
    expect(document.querySelector('.mascot')).toBeNull() // 作成ビューでは出さない

    fireEvent.click(createButton())
    expect(mascotText()).toContain('夕食')

    // 全部終わればねぎらいに変わる
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: '完了' }))
    }
    expect(mascotText()).toContain('3時間20分')
  })

  it('登録したきめごとは、その場面でミニキャラのセリフになる', () => {
    saveRules([
      {
        id: 'x1',
        trigger: { type: 'ALL_DONE' },
        action: '何を見るか先に決めてから開く',
        order: 0,
      },
    ])
    renderStarted()
    // 実行中は当てはまらないので通常のセリフ
    expect(mascotText()).toContain('夕食')

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: '完了' }))
    }
    expect(mascotText()).toContain('何を見るか先に決めてから開く')
    expect(document.querySelector('.mascot-tag')?.textContent).toBe('きめごと')
  })
})

describe('SceneTab: 日の切り替わり(F5)', () => {
  const lastNightPlan: ScenePlan = {
    dayKey: '2026-07-07',
    endAt: 1470,
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

  it('翌日に開くと前日のプラン(実行中でも)は破棄され、作成ビューから始まる', () => {
    saveScenePlan(NIGHT.id, lastNightPlan) // 前夜(7/7)の実行中プラン。現在は 7/8 21:10
    render(<SceneTab />)

    expect(
      screen.getByRole('heading', { name: '夜のプラン' }),
    ).toBeInTheDocument()
    // ルーチン全件が未完了・選択済みで作り直されている
    const checks = screen.getAllByRole('checkbox')
    expect(checks).toHaveLength(4)
    expect(loadScenePlan(NIGHT.id)?.dayKey).toBe('2026-07-08')
  })

  it('深夜 0 時を過ぎても(朝 4 時まで)同じ日としてプランを保持する', () => {
    saveScenePlan(NIGHT.id, { ...lastNightPlan, dayKey: '2026-07-08' })
    vi.setSystemTime(new Date(2026, 6, 9, 1, 0)) // 翌 1:00 = 25:00

    render(<SceneTab />)
    expect(
      screen.getByRole('heading', { name: '夜のスケジュール' }),
    ).toBeInTheDocument()
    expect(loadScenePlan(NIGHT.id)?.dayKey).toBe('2026-07-08')
  })

  it('朝 4 時を過ぎると新しい日になる', () => {
    saveScenePlan(NIGHT.id, { ...lastNightPlan, dayKey: '2026-07-08' })
    vi.setSystemTime(new Date(2026, 6, 9, 4, 0)) // 朝 4:00

    render(<SceneTab />)
    expect(
      screen.getByRole('heading', { name: '夜のプラン' }),
    ).toBeInTheDocument()
    expect(loadScenePlan(NIGHT.id)?.dayKey).toBe('2026-07-09')
  })
})

describe('SceneTab: 終了なしプラン', () => {
  const HOLIDAY = { id: 'holiday', name: '休日家事', order: 1 } // defaultEnd なし

  function seedHoliday() {
    vi.setSystemTime(new Date(2026, 6, 8, 13, 0)) // 休日の昼 13:00
    saveScenes([NIGHT, HOLIDAY])
    saveCurrentSceneId(HOLIDAY.id)
    saveRoutines(HOLIDAY.id, [
      { id: 'h1', name: '掃除', durationMin: 30, order: 0 },
      { id: 'h2', name: '買い出し', durationMin: 60, order: 1 },
    ])
  }

  it('終了なしシーンは終了時刻が空欄のまま作成でき、ヘッダに終わる見込みが出る', () => {
    seedHoliday()
    render(<SceneTab />)

    expect(screen.getByLabelText('終了時刻')).toHaveValue('')
    expect(createButton()).not.toBeDisabled()
    fireEvent.click(createButton())

    // 13:00 開始で掃除 30 分+買い出し 60 分 → 見込み 14:30。「終了まで」は出ない
    expect(screen.getByText(/終わる見込み 14:30/)).toBeInTheDocument()
    expect(screen.queryByText(/終了まで/)).not.toBeInTheDocument()
    expect(tlRows()).toEqual([
      '13:00〜13:30掃除',
      '13:30〜14:30買い出し',
    ])
  })

  it('終了なしでも予定比は出て、早い完了で見込みが縮む', () => {
    seedHoliday()
    render(<SceneTab />)
    fireEvent.click(createButton())

    vi.setSystemTime(new Date(2026, 6, 8, 13, 20))
    fireEvent.click(screen.getByRole('button', { name: '完了' })) // 掃除を 13:20 完了

    // 予定 13:30 → 実績 13:20 = -10分(行と全体)。買い出しは 13:20〜14:20 に前倒し
    expect(screen.getAllByText('-10分')).toHaveLength(2)
    expect(screen.getByText(/終わる見込み 14:20/)).toBeInTheDocument()
  })

  it('終了なしの全完了はご褒美画面(自由時間表記なし)になる', () => {
    seedHoliday()
    render(<SceneTab />)
    fireEvent.click(createButton())
    fireEvent.click(screen.getByRole('button', { name: '完了' }))
    fireEvent.click(screen.getByRole('button', { name: '完了' }))

    expect(
      screen.getByText('おつかれさま!全部終わりました'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('きょうの分は完走です。あとは堂々と自由にどうぞ'),
    ).toBeInTheDocument()
    expect(screen.getByText(/全タスク完了/)).toBeInTheDocument()
  })

  it('終了なしシーンではミニキャラが残り時間ではなくシーン名で完走をたたえる', () => {
    seedHoliday()
    render(<SceneTab />)
    fireEvent.click(createButton())
    expect(mascotText()).toContain('掃除')

    fireEvent.click(screen.getByRole('button', { name: '完了' }))
    fireEvent.click(screen.getByRole('button', { name: '完了' }))
    expect(mascotText()).toContain('休日家事')
  })

  it('終了ありのシーンでも、終了時刻を空欄にすれば締切なしで組める', () => {
    render(<SceneTab />) // 夜シーン(21:10、デフォルト 24:30)
    fireEvent.change(screen.getByLabelText('終了時刻'), {
      target: { value: '' },
    })
    expect(createButton()).not.toBeDisabled()
    fireEvent.click(createButton())

    expect(screen.getByText(/終わる見込み/)).toBeInTheDocument()
    expect(screen.queryByText(/終了まで/)).not.toBeInTheDocument()
    // 終了なしなので「収まりません」警告も出ない
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('SceneTab: シーン切り替え', () => {
  const MORNING = { id: 'morning', name: '朝', defaultEnd: 480, order: 1 }

  function seedTwoScenes() {
    vi.setSystemTime(new Date(2026, 6, 8, 6, 30)) // 朝 6:30
    saveScenes([NIGHT, MORNING])
    saveCurrentSceneId(NIGHT.id)
    saveRoutines(MORNING.id, [
      { id: 'm1', name: '朝食', durationMin: 10, order: 0 },
    ])
  }

  it('シーンを切り替えるとルーチンとプランが独立している', () => {
    seedTwoScenes()
    render(<SceneTab />)
    expect(
      screen.getByRole('heading', { name: '夜のプラン' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: '朝' }))
    expect(
      screen.getByRole('heading', { name: '朝のプラン' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /朝食/ })).toBeChecked()
    expect(screen.getByLabelText('終了時刻')).toHaveValue('8:00')

    // 朝のスケジュールを開始しても夜のプランには影響しない
    fireEvent.click(createButton())
    expect(
      screen.getByRole('heading', { name: '朝のスケジュール' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '夜' }))
    expect(
      screen.getByRole('heading', { name: '夜のプラン' }),
    ).toBeInTheDocument()
    expect(loadScenePlan(MORNING.id)?.started).toBe(true)
    expect(loadScenePlan(NIGHT.id)?.started).toBe(false)
  })

  it('選んだシーンは開き直しても記憶される', () => {
    seedTwoScenes()
    const view = render(<SceneTab />)
    fireEvent.click(screen.getByRole('button', { name: '朝' }))
    view.unmount()

    render(<SceneTab />)
    expect(
      screen.getByRole('heading', { name: '朝のプラン' }),
    ).toBeInTheDocument()
  })
})
