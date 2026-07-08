import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

beforeEach(() => {
  localStorage.clear()
})

describe('App', () => {
  it('タイトルと下部タブバーが表示され、初期タブは「今夜」', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'スケジュール計画立案' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '今夜' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText(/今夜のプラン作成/)).toBeInTheDocument()
  })

  it('3 つのタブを切り替えられる', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'ルーチン' }))
    expect(screen.getByRole('heading', { name: 'ルーチン' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '設定' }))
    expect(screen.getByRole('heading', { name: '設定' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '今夜' }))
    expect(screen.getByText(/今夜のプラン作成/)).toBeInTheDocument()
  })
})
