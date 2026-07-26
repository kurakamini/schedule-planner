import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RulesTab } from './RulesTab'
import { loadRules } from '../../lib/storage'

beforeEach(() => {
  localStorage.clear()
})

const addButton = () => screen.getByRole('button', { name: '追加' })

/** 一覧の「もし〜」+ action を 1 行の文字列にする */
const ruleRows = () =>
  [...document.querySelectorAll('.routine-row')].map(
    (li) =>
      `${li.querySelector('.routine-meta')?.textContent} → ${li.querySelector('.routine-name')?.textContent}`,
  )

describe('RulesTab', () => {
  it('自由時間のきめごとを追加でき、保存される', () => {
    render(<RulesTab />)
    fireEvent.change(screen.getByLabelText('そのときやること'), {
      target: { value: '10分タイマーをかけてから開く' },
    })
    fireEvent.click(addButton())

    expect(ruleRows()).toEqual([
      'もし 自由時間になったら → 10分タイマーをかけてから開く',
    ])
    expect(loadRules()).toHaveLength(1)
  })

  it('action が空では追加できない', () => {
    render(<RulesTab />)
    expect(addButton()).toBeDisabled()
  })

  it('タスク名トリガーは名前を入れるまで追加できない', () => {
    render(<RulesTab />)
    fireEvent.change(screen.getByLabelText('きっかけ'), {
      target: { value: 'TASK_START' },
    })
    fireEvent.change(screen.getByLabelText('そのときやること'), {
      target: { value: 'まず教材を開く' },
    })
    expect(addButton()).toBeDisabled()

    fireEvent.change(screen.getByLabelText('タスク名'), {
      target: { value: '英語' },
    })
    fireEvent.click(addButton())
    expect(ruleRows()).toEqual(['もし 英語 を始めるとき → まず教材を開く'])
  })

  it('時刻トリガーはコロンなしで入力でき、読めない時刻は弾く', () => {
    render(<RulesTab />)
    fireEvent.change(screen.getByLabelText('きっかけ'), {
      target: { value: 'TIME' },
    })
    fireEvent.change(screen.getByLabelText('そのときやること'), {
      target: { value: '1本を見終えて終了する' },
    })

    fireEvent.change(screen.getByLabelText('時刻'), { target: { value: '99' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/読み取れません/)
    expect(addButton()).toBeDisabled()

    fireEvent.change(screen.getByLabelText('時刻'), {
      target: { value: '2230' },
    })
    fireEvent.click(addButton())
    expect(ruleRows()).toEqual([
      'もし 22:30 を過ぎたら → 1本を見終えて終了する',
    ])
  })

  it('編集すると内容が置き換わる', () => {
    render(<RulesTab />)
    fireEvent.change(screen.getByLabelText('そのときやること'), {
      target: { value: '先に机で15分だけ手を動かす' },
    })
    fireEvent.click(addButton())

    fireEvent.click(
      screen.getByRole('button', { name: '先に机で15分だけ手を動かす を編集' }),
    )
    fireEvent.change(screen.getByLabelText('きっかけ'), {
      target: { value: 'ALL_DONE' },
    })
    fireEvent.change(screen.getByLabelText('そのときやること'), {
      target: { value: '何を見るか先に決めてから開く' },
    })
    fireEvent.click(screen.getByRole('button', { name: '更新' }))

    expect(ruleRows()).toEqual([
      'もし ぜんぶ終わったら → 何を見るか先に決めてから開く',
    ])
    expect(loadRules()).toHaveLength(1)
  })

  it('削除は確認ダイアログを挟み、キャンセルなら消えない', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<RulesTab />)
    fireEvent.change(screen.getByLabelText('そのときやること'), {
      target: { value: '一度立って水を飲みに行く' },
    })
    fireEvent.click(addButton())

    fireEvent.click(
      screen.getByRole('button', { name: '一度立って水を飲みに行く を削除' }),
    )
    expect(confirmSpy).toHaveBeenCalledWith(
      '「一度立って水を飲みに行く」を削除しますか?',
    )
    expect(ruleRows()).toHaveLength(1)

    confirmSpy.mockReturnValue(true)
    fireEvent.click(
      screen.getByRole('button', { name: '一度立って水を飲みに行く を削除' }),
    )
    expect(loadRules()).toEqual([])
  })

  it('「例を入れてみる」で初期セットが入り、並べ替えできる', () => {
    render(<RulesTab />)
    fireEvent.click(screen.getByRole('button', { name: '例を入れてみる' }))
    expect(ruleRows()).toHaveLength(3)

    const second = loadRules()[1].action
    fireEvent.click(screen.getByRole('button', { name: `${second} を上へ` }))
    expect(loadRules()[0].action).toBe(second)
    expect(loadRules()[0].order).toBe(0)
  })
})
