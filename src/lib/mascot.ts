// 実行ビューに出るミニキャラのセリフを決める純関数。
// React・DOM には依存しない(見た目は components/tonight/Mascot.tsx)。
//
// セリフは候補からランダムに見えるように選ぶが、実際には seed から決めている。
// 現在時刻は 30 秒ごとに更新される(useNow)ため、乱数で選ぶと再描画のたびに
// セリフが変わってしまう。タスクが切り替わったときだけ変わるようにする。
//
// シーンは夜だけとは限らない(朝・休日など)。「寝よう」のような夜前提の言い回しは
// 避け、終了時刻を持たないシーンでも成り立つ文にする。

import { formatDuration, formatNightTime } from './time'

export type MascotMood =
  | 'go' // これからやる: やる気を出す
  | 'hurry' // 残りわずか / 予定を過ぎている
  | 'rest' // 固定予定待ちの自由時間
  | 'done' // 全部終わった
  | 'sleepy' // 終了時刻を過ぎている
  | 'idle' // きょうやることがない

export type MascotLine = { mood: MascotMood; text: string }

/** 残りこの分数以下になったらラストスパートを煽る */
const HURRY_MIN = 5

type Base = {
  /** セリフ選択の種。日ごとに、同じ状況でも違うセリフになる */
  dayKey: string
  /** シーン名(夜・朝・休日など) */
  sceneName: string
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

export function pickMascotLine(state: MascotState): MascotLine {
  if (state.kind === 'empty') {
    return {
      mood: 'idle',
      text: 'きょうやること、空っぽだよ！下の「プランを編集」から選ぼう！',
    }
  }

  if (state.kind === 'allDone') {
    if (state.untilEnd === null) {
      return {
        mood: 'done',
        text: `${state.sceneName}のぶん、ぜんぶ終わったー！完走だよ、おつかれさま！`,
      }
    }
    if (state.untilEnd <= 0) {
      return {
        mood: 'sleepy',
        text: 'ぜんぶ終わったよ、おつかれさま！ゆっくり休んで〜',
      }
    }
    const free = formatDuration(state.untilEnd)
    return choose('done', state.dayKey, [
      `ぜんぶ終わったー！あとの ${free} は好きに使っていいよ！`,
      `やりきったね！${free} まるまる自由時間、堂々とどうぞ！`,
      `完ぺき！ここから ${free} はごほうびタイムだよ！`,
    ])
  }

  // ここから先は残っているタスクがある状態
  const seed = `${state.dayKey}:${state.taskId}`

  if (state.untilEnd !== null && state.untilEnd <= 0) {
    return choose('sleepy', seed, [
      `もう終了時刻すぎてるよ！${state.taskName} で切り上げよう`,
      'そろそろタイムオーバー…！残りは明日にまわしてもいいからね',
    ])
  }

  if (state.kind === 'waiting') {
    const wait = formatDuration(state.waitMin)
    const at = formatNightTime(state.startAt)
    return choose('rest', seed, [
      `${at} まで ${wait} 自由時間！ちょっと休憩しよ`,
      `次は ${state.taskName}。${at} までの ${wait} は好きにしていいよ！`,
      `${wait} だけおやすみタイム！${at} になったら ${state.taskName} だよ`,
    ])
  }

  if (state.leftMin <= 0) {
    return choose('hurry', seed, [
      `${state.taskName} ちょっと押してるよ！終わったら完了を押してね`,
      `おーい、${state.taskName} まだかな？あと少し、いける！`,
    ])
  }

  const left = formatDuration(state.leftMin)

  if (state.leftMin <= HURRY_MIN) {
    return choose('hurry', seed, [
      `${state.taskName} ラスト ${left}！ふんばれ〜！`,
      `もうすぐ時間だよ！${state.taskName} あと ${left}！`,
    ])
  }

  return choose('go', seed, [
    `よし、${state.taskName} いこう！あと ${left} で終わらせよう！`,
    `${state.taskName} の時間だよ！${left} あればいけるいける！`,
    `せーの、${state.taskName} スタート！終わったら完了ボタンね！`,
    `${state.taskName} からいこう！サクッと ${left} でキメよう！`,
  ])
}

/** seed から候補を 1 つ選ぶ(同じ seed なら常に同じセリフ) */
function choose(
  mood: MascotMood,
  seed: string,
  texts: string[],
): MascotLine {
  return { mood, text: texts[hash(`${seed}:${mood}`) % texts.length] }
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}
