import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// vitest の globals を無効にしているため、Testing Library の
// 自動クリーンアップは働かない。ここで明示的に登録する
afterEach(() => {
  cleanup()
})
