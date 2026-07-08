import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateId } from './id'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generateId', () => {
  it('一意な ID を生成する', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()))
    expect(ids.size).toBe(1000)
  })

  it('crypto.randomUUID が無い環境(http 接続)でも動く', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
      // randomUUID は定義しない = 非セキュアコンテキストを再現
    })
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()))
    expect(ids.size).toBe(1000)
    expect(generateId()).toMatch(/^[0-9a-f]{32}$/)
  })
})
