// 夜通算分(NightMinutes): その夜の基準日 0:00 からの通算分。
// 24:30 → 1470、25:00(翌 1:00)→ 1500。
// 0:00〜3:59 は「前夜の続き」として +1440 分で扱う(夜の境界は朝 4 時)。
// 詳細: docs/spec/design.md「時刻の扱い」

/** 夜の境界(この時刻より前は前夜の続き) */
export const NIGHT_BOUNDARY_HOUR = 4

const DAY_MIN = 24 * 60

/** パース可能な上限時(27:59 = 翌 3:59 まで) */
const MAX_HOUR = 27

/**
 * "HH:MM" 形式の文字列を夜通算分にする。不正な入力は null。
 * "0:30" のような 0〜3 時台は翌日扱いに正規化する("0:30" → 1470)。
 * 全角数字・全角コロンも受け付ける。
 */
export function parseNightTime(input: string): number | null {
  // 全角数字(０-９)と全角コロン(：)を半角に正規化
  const normalized = input
    .trim()
    .replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    )
    .replace(/：/g, ':')
  const m = /^(\d{1,2}):(\d{2})$/.exec(normalized)
  if (!m) return null
  const hours = Number(m[1])
  const minutes = Number(m[2])
  if (hours > MAX_HOUR || minutes > 59) return null
  const total = hours * 60 + minutes
  return hours < NIGHT_BOUNDARY_HOUR ? total + DAY_MIN : total
}

/** 夜通算分を "24:30" 形式にする(時はゼロ埋めしない、分は 2 桁) */
export function formatNightTime(nightMinutes: number): string {
  const hours = Math.floor(nightMinutes / 60)
  const minutes = nightMinutes % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

/** Date を夜通算分にする(0:00〜3:59 は前夜の続きとして +1440) */
export function toNightMinutes(date: Date): number {
  const total = date.getHours() * 60 + date.getMinutes()
  return date.getHours() < NIGHT_BOUNDARY_HOUR ? total + DAY_MIN : total
}

/** Date から夜の識別子("2026-07-08" 形式)を得る。朝 4 時までは前日の夜 */
export function getNightKey(date: Date): string {
  const base = new Date(date.getTime() - NIGHT_BOUNDARY_HOUR * 60 * 60 * 1000)
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 分数を "1時間20分" 形式にする(自由時間などの表示用) */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}
