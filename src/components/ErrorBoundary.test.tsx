import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

afterEach(() => {
  vi.restoreAllMocks()
})

function Bomb(): never {
  throw new Error('テスト用クラッシュ')
}

describe('ErrorBoundary', () => {
  it('正常時は子をそのまま表示する', () => {
    render(
      <ErrorBoundary>
        <p>正常なコンテンツ</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('正常なコンテンツ')).toBeInTheDocument()
  })

  it('子がクラッシュしたらエラー内容とリロードボタンを表示する', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    expect(screen.getByText('テスト用クラッシュ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'リロード' })).toBeInTheDocument()
  })
})
