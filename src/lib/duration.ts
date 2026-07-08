// 所要時間(分)のパース。1〜999 の整数のみ許可。
// 時刻入力(time.ts)と同様に全角数字も受け付ける(入力手段による差をなくす)。

/** "30" や全角 "３０" を分数にする。1〜999 の整数以外は null */
export function parseDurationMin(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  if (!/^\d{1,3}$/.test(normalized)) return null
  const n = Number(normalized)
  return n >= 1 ? n : null
}
