import { useCallback, useEffect, useState } from 'react'
import type { PlanItem, RoutineTask, TonightPlan } from '../types'
import { buildSchedule } from '../lib/scheduler'
import { generateId } from '../lib/id'
import { getNightKey, toNightMinutes } from '../lib/time'
import { loadTonightPlan, saveTonightPlan } from '../lib/storage'

export type AdhocInput = {
  name: string
  durationMin: number
  fixedStart?: number
}

function routineToItem(r: RoutineTask, order: number): PlanItem {
  return {
    id: generateId(),
    routineId: r.id,
    name: r.name,
    durationMin: r.durationMin,
    fixedStart: r.fixedStart,
    order,
    included: true,
    done: false,
  }
}

function renumber(items: PlanItem[]): PlanItem[] {
  return items.map((it, i) => ({ ...it, order: i }))
}

/** 現在の先頭タスク(NOW カードに出るタスク)の ID */
function headIdOf(
  plan: Pick<TonightPlan, 'anchorAt' | 'bedtime'>,
  items: PlanItem[],
): string | undefined {
  const pending = items.filter((it) => it.included && !it.done)
  return buildSchedule({
    items: pending,
    now: plan.anchorAt,
    bedtime: plan.bedtime,
  }).scheduled[0]?.itemId
}

/**
 * 実行中に先頭タスクが変わる操作(完了・取り消し・外す・追加)をした時だけ、
 * アンカー(スケジュールの起点)を操作時点の時刻に進める。
 * 時間経過やアプリの開き直しではアンカーを動かさない(開始時刻を保持する)。
 */
function reanchor(prev: TonightPlan, nextItems: PlanItem[]): number {
  if (!prev.started) return prev.anchorAt
  return headIdOf(prev, prev.items) !== headIdOf(prev, nextItems)
    ? toNightMinutes(new Date())
    : prev.anchorAt
}

/**
 * プラン未作成ならルーチン全件を選択済みで初期化する(開始時刻の初期値は現在時刻)。
 * 夜が変わっていたら(nightKey 不一致)前夜のプランを破棄して作り直す(F5)。
 * 深夜 0 時を過ぎても朝 4 時までは同じ夜として扱う。
 * 作成ビュー表示中(started: false)は、あとから登録されたルーチンを末尾に取り込む
 * (当夜の調整=チェック・並び順・当日タスクはそのまま残す。
 * 開始時刻の開き直し時の追従は catchUpAnchor が担当)。
 */
function syncWithRoutines(
  stored: TonightPlan | null,
  routines: RoutineTask[],
  defaultBedtime: number,
): TonightPlan {
  const nightKey = getNightKey(new Date())
  const prev = stored !== null && stored.nightKey === nightKey ? stored : null
  if (prev?.started) return prev
  if (!prev) {
    return {
      nightKey,
      bedtime: defaultBedtime,
      started: false,
      anchorAt: toNightMinutes(new Date()),
      items: routines.map((r, i) => routineToItem(r, i)),
    }
  }
  const known = new Set(
    prev.items.map((it) => it.routineId).filter((id) => id !== undefined),
  )
  const missing = routines.filter((r) => !known.has(r.id))
  if (missing.length === 0) return prev
  return {
    ...prev,
    items: renumber([
      ...prev.items,
      ...missing.map((r, i) => routineToItem(r, prev.items.length + i)),
    ]),
  }
}

/**
 * 開き直し(マウント・画面復帰)時に開始時刻を現在へ追従させる。
 * 作成ビュー中(started: false)で開始時刻が過去になっていたら現在時刻に進める。
 * 未来に設定した値(帰宅前の仕込み)と実行中のアンカーは動かさない。
 */
function catchUpAnchor(plan: TonightPlan): TonightPlan {
  if (plan.started) return plan
  const now = toNightMinutes(new Date())
  return plan.anchorAt < now ? { ...plan, anchorAt: now } : plan
}

/**
 * RTA 表示の基準タイムを凍結する。開始時点の配置から各タスクの予定終了を記録し、
 * 実行中は「基準 vs 実績」で予定比(±)を出す(完了による再配置では基準を動かさない)。
 * 再編集からの開始では未完了分だけ引き直し、完了済みの基準(過去の実績比較)は保持する
 */
function snapshotBaseline(prev: TonightPlan): Record<string, number> {
  const pending = prev.items.filter((it) => it.included && !it.done)
  const { scheduled } = buildSchedule({
    items: pending,
    now: prev.anchorAt,
    bedtime: prev.bedtime,
  })
  const next: Record<string, number> = {}
  for (const it of prev.items) {
    const kept = prev.baselineEnds?.[it.id]
    if (it.done && kept !== undefined) next[it.id] = kept
  }
  for (const s of scheduled) next[s.itemId] = s.end
  return next
}

export function useTonightPlan(routines: RoutineTask[], defaultBedtime: number) {
  const [plan, setPlan] = useState<TonightPlan>(() =>
    catchUpAnchor(syncWithRoutines(loadTonightPlan(), routines, defaultBedtime)),
  )

  // スマホはリロードなしでブラウザに戻ることが多く、マウント時だけでは
  // 開始時刻が古いままになるため、画面復帰時にも追従させる
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      setPlan((prev) => {
        const next = catchUpAnchor(prev)
        if (next !== prev) saveTonightPlan(next)
        return next
      })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // ルーチンの後追い登録を作成ビューに反映する。
  // 同期結果は毎回保存し、表示中のプランとストレージを常に一致させる
  // (保存しないと、導出だけされたプランが再マウントのたびに作り直される)
  useEffect(() => {
    setPlan((prev) => {
      const next = syncWithRoutines(prev, routines, defaultBedtime)
      saveTonightPlan(next)
      return next
    })
  }, [routines, defaultBedtime])

  const mutate = useCallback((fn: (prev: TonightPlan) => TonightPlan) => {
    setPlan((prev) => {
      const next = fn(prev)
      saveTonightPlan(next)
      return next
    })
  }, [])

  const toggleIncluded = useCallback(
    (id: string) => {
      mutate((prev) => {
        const items = prev.items.map((it) =>
          it.id === id ? { ...it, included: !it.included } : it,
        )
        return { ...prev, items, anchorAt: reanchor(prev, items) }
      })
    },
    [mutate],
  )

  const toggleDone = useCallback(
    (id: string) => {
      mutate((prev) => {
        const items = prev.items.map((it) =>
          it.id === id
            ? {
                ...it,
                done: !it.done,
                doneAt: it.done ? undefined : toNightMinutes(new Date()),
              }
            : it,
        )
        return { ...prev, items, anchorAt: reanchor(prev, items) }
      })
    },
    [mutate],
  )

  const moveItem = useCallback(
    (id: string, direction: -1 | 1) => {
      mutate((prev) => {
        const items = [...prev.items].sort((a, b) => a.order - b.order)
        const i = items.findIndex((it) => it.id === id)
        const j = i + direction
        if (i < 0 || j < 0 || j >= items.length) return prev
        ;[items[i], items[j]] = [items[j], items[i]]
        return { ...prev, items: renumber(items) }
      })
    },
    [mutate],
  )

  const addItem = useCallback(
    (input: AdhocInput) => {
      mutate((prev) => {
        const items = renumber([
          ...prev.items,
          {
            id: generateId(),
            name: input.name,
            durationMin: input.durationMin,
            fixedStart: input.fixedStart,
            order: prev.items.length,
            included: true,
            done: false,
          },
        ])
        return { ...prev, items, anchorAt: reanchor(prev, items) }
      })
    },
    [mutate],
  )

  const setBedtime = useCallback(
    (bedtime: number) => {
      mutate((prev) => ({ ...prev, bedtime }))
    },
    [mutate],
  )

  /** 開始時刻(アンカー)の手動設定。作成ビューの入力欄から使う */
  const setAnchor = useCallback(
    (anchorAt: number) => {
      mutate((prev) => ({ ...prev, anchorAt }))
    },
    [mutate],
  )

  // 開始時刻は入力欄の値(anchorAt)をそのまま使うため、ここでは再スタンプしない
  const start = useCallback(() => {
    mutate((prev) => ({
      ...prev,
      started: true,
      baselineEnds: snapshotBaseline(prev),
    }))
  }, [mutate])

  const backToEdit = useCallback(() => {
    mutate((prev) => ({ ...prev, started: false }))
  }, [mutate])

  return {
    plan,
    toggleIncluded,
    toggleDone,
    moveItem,
    addItem,
    setBedtime,
    setAnchor,
    start,
    backToEdit,
  }
}
