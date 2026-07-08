import { useEffect, useState } from 'react'
import { toNightMinutes } from '../lib/time'

/** 現在時刻(夜通算分)。時間経過でタイムラインが引き直されるよう定期更新する */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => toNightMinutes(new Date()))

  useEffect(() => {
    const id = setInterval(() => {
      setNow(toNightMinutes(new Date()))
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
