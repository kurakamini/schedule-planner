import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * クラッシュ時に白画面ではなくエラー内容を表示する。
 * スマホ実機には DevTools がなく、白画面だと原因調査の手がかりが残らないため
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('アプリがクラッシュしました:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="crash" role="alert">
          <h1>エラーが発生しました</h1>
          <p className="crash-message">{this.state.error.message}</p>
          <button type="button" onClick={() => location.reload()}>
            リロード
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
