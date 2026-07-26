// 実行ビューに出るミニキャラのセリフを決める純関数。
// React・DOM には依存しない(見た目は components/tonight/Mascot.tsx)。
//
// セリフは候補からランダムに見えるように選ぶが、実際には seed から決めている。
// 現在時刻は 30 秒ごとに更新される(useNow)ため、乱数で選ぶと再描画のたびに
// セリフが変わってしまう。タスクが切り替わったときだけ変わるようにする。
//
// シーンは夜だけとは限らない(朝・休日など)。「寝よう」のような夜前提の言い回しは
// 避け、終了時刻を持たないシーンでも成り立つ文にする。
//
// if-then ルール(実行意図)が当てはまるときは、そのルールの action を
// 言い換えずそのまま出す。時刻の合図に言い換えると効果が落ちるため
// (docs/handover-schedule-planner.md 方針B)。

import type { Rule, RuleTrigger } from '../types'
import { formatDuration, formatNightTime } from './time'

export type MascotMood =
  | 'go' // これからやる: やる気を出す
  | 'hurry' // 残りわずか / 予定を過ぎている
  | 'rest' // 固定予定待ちの自由時間
  | 'done' // 全部終わった
  | 'sleepy' // 終了時刻を過ぎている
  | 'idle' // きょうやることがない

export type MascotLine = {
  mood: MascotMood
  text: string
  /** if-then ルール由来ならその ID(表示上「きめごと」と分かるようにする) */
  ruleId?: string
}

/** 残りこの分数以下になったらラストスパートを煽る */
const HURRY_MIN = 5

type Base = {
  /** セリフ選択の種。日ごとに、同じ状況でも違うセリフになる */
  dayKey: string
  /** シーン名(夜・朝・休日など) */
  sceneName: string
  /** 現在時刻(夜通算分)。TIME ルールの判定に使う */
  now: number
  /** 終了までの残り(分)。null = 終了時刻を決めないシーン。0 以下 = 過ぎている */
  untilEnd: number | null
}

export type MascotState = Base &
  (
    | { kind: 'empty' }
    | { kind: 'allDone' }
    /** いまやるタスクがある。leftMin は終了予定までの残り(0 以下 = 超過) */
    | { kind: 'now'; taskId: string; taskName: string; leftMin: number }
    /** 固定予定待ち。startAt から始まり、それまで waitMin 分空いている */
    | {
        kind: 'waiting'
        taskId: string
        taskName: string
        startAt: number
        waitMin: number
      }
  )

export function pickMascotLine(
  state: MascotState,
  rules: Rule[] = [],
): MascotLine {
  const mood = moodFor(state)
  const rule = matchRule(state, rules)
  if (rule) return { mood, text: rule.action, ruleId: rule.id }
  return { mood, text: defaultText(state) }
}

/** 表情は if-then ルールの有無にかかわらず、いまの状況だけで決める */
function moodFor(state: MascotState): MascotMood {
  if (state.kind === 'empty') return 'idle'
  const overEnd = state.untilEnd !== null && state.untilEnd <= 0
  if (state.kind === 'allDone') return overEnd ? 'sleepy' : 'done'
  if (overEnd) return 'sleepy'
  if (state.kind === 'waiting') return 'rest'
  return state.leftMin <= HURRY_MIN ? 'hurry' : 'go'
}

/**
 * いまの状況に当てはまるルールを 1 件選ぶ。
 * 「その瞬間」に効く状況トリガーを優先し、常時掲示になる TIME は最後に見る
 */
function matchRule(state: MascotState, rules: Rule[]): Rule | undefined {
  const sorted = [...rules].sort((a, b) => a.order - b.order)

  const byState = sorted.find((r) => matchesState(r.trigger, state))
  if (byState) return byState

  // 過ぎた TIME ルールのうち、いちばん近いもの(遅い時刻)を出す
  const passed = sorted.flatMap((rule) =>
    rule.trigger.type === 'TIME' && state.now >= rule.trigger.at
      ? [{ rule, at: rule.trigger.at }]
      : [],
  )
  passed.sort((a, b) => b.at - a.at)
  return passed[0]?.rule
}

function matchesState(trigger: RuleTrigger, state: MascotState): boolean {
  switch (trigger.type) {
    case 'FREE_TIME':
      return state.kind === 'waiting'
    case 'ALL_DONE':
      return state.kind === 'allDone'
    case 'TASK_START':
      return state.kind === 'now' && state.taskName === trigger.taskName
    case 'TIME':
      return false // 状況ではなく時刻で判定する(matchRule 側)
  }
}

/** ルールが当てはまらないときの通常のセリフ */
function defaultText(state: MascotState): string {
  if (state.kind === 'empty') {
    return 'きょうやること、空っぽだよ！下の「プランを編集」から選ぼう！'
  }

  if (state.kind === 'allDone') {
    if (state.untilEnd === null) {
      return `${state.sceneName}のぶん、ぜんぶ終わったー！完走だよ、おつかれさま！`
    }
    if (state.untilEnd <= 0) {
      return 'ぜんぶ終わったよ、おつかれさま！ゆっくり休んで〜'
    }
    const free = formatDuration(state.untilEnd)
    return choose(state.dayKey, [
      `ぜんぶ終わったー！あとの ${free} は好きに使っていいよ！`,
      `やりきったね！${free} まるまる自由時間、堂々とどうぞ！`,
      `完ぺき！ここから ${free} はごほうびタイムだよ！`,
    ])
  }

  // ここから先は残っているタスクがある状態
  const seed = `${state.dayKey}:${state.taskId}`

  if (state.untilEnd !== null && state.untilEnd <= 0) {
    return choose(seed, [
      `もう終了時刻すぎてるよ！${state.taskName} で切り上げよう`,
      'そろそろタイムオーバー…！残りは明日にまわしてもいいからね',
    ])
  }

  if (state.kind === 'waiting') {
    const wait = formatDuration(state.waitMin)
    const at = formatNightTime(state.startAt)
    return choose(seed, [
      `${at} まで ${wait} 自由時間！ちょっと休憩しよ`,
      `次は ${state.taskName}。${at} までの ${wait} は好きにしていいよ！`,
      `${wait} だけおやすみタイム！${at} になったら ${state.taskName} だよ`,
    ])
  }

  if (state.leftMin <= 0) {
    return choose(seed, [
      `${state.taskName} ちょっと押してるよ！終わったら完了を押してね`,
      `おーい、${state.taskName} まだかな？あと少し、いける！`,
    ])
  }

  const left = formatDuration(state.leftMin)

  if (state.leftMin <= HURRY_MIN) {
    return choose(seed, [
      `${state.taskName} ラスト ${left}！ふんばれ〜！`,
      `もうすぐ時間だよ！${state.taskName} あと ${left}！`,
    ])
  }

  return choose(seed, [
    `よし、${state.taskName} いこう！あと ${left} で終わらせよう！`,
    `${state.taskName} の時間だよ！${left} あればいけるいける！`,
    `せーの、${state.taskName} スタート！終わったら完了ボタンね！`,
    `${state.taskName} からいこう！サクッと ${left} でキメよう！`,
  ])
}

/** seed から候補を 1 つ選ぶ(同じ seed なら常に同じセリフ) */
function choose(seed: string, texts: string[]): string {
  return texts[hash(seed) % texts.length]
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}
