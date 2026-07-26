// 「きょう」タブの実行ビューに出るミニキャラのセリフを決める純関数。
// React・DOM には依存しない(見た目は components/tonight/Mascot.tsx)。
//
// セリフは候補からランダムに見えるように選ぶが、実際には seed から決めている。
// 現在時刻は 30 秒ごとに更新される(useNow)ため、乱数で選ぶと再描画のたびに
// セリフが変わってしまう。タスクが切り替わったときだけ変わるようにする。

import { formatDuration, formatNightTime } from './time'

export type MascotMood =
  | 'go' // これからやる: やる気を出す
  | 'hurry' // 残りわずか / 予定を過ぎている
  | 'rest' // 固定予定待ちの自由時間
  | 'done' // 全部終わった
  | 'sleepy' // 就寝時刻を過ぎている
  | 'idle' // 今夜やることがない

export type MascotLine = { mood: MascotMood; text: string }

/** 残りこの分数以下になったらラストスパートを煽る */
const HURRY_MIN = 5

type Base = {
  /** セリフ選択の種。夜ごとに同じ状況でも違うセリフになる */
  nightKey: string
  /** 就寝までの残り(分)。0 以下なら就寝時刻を過ぎている */
  untilBedtime: number
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
      text: '今夜やること、空っぽだよ！下の「プランを編集」から選ぼう！',
    }
  }

  if (state.kind === 'allDone') {
    if (state.untilBedtime <= 0) {
      return {
        mood: 'sleepy',
        text: 'ぜんぶ終わったよ、おつかれさま！もう寝よう〜',
      }
    }
    const free = formatDuration(state.untilBedtime)
    return choose('done', state.nightKey, [
      `ぜんぶ終わったー！あとの ${free} は好きに使っていいよ！`,
      `やりきったね！${free} まるまる自由時間、堂々とどうぞ！`,
      `完ぺき！ここから ${free} はごほうびタイムだよ！`,
    ])
  }

  // ここから先は残っているタスクがある状態
  const seed = `${state.nightKey}:${state.taskId}`

  if (state.untilBedtime <= 0) {
    return choose('sleepy', seed, [
      `もう就寝時刻すぎてるよ！${state.taskName} が終わったら寝よう`,
      'そろそろ限界の時間…！残りは明日にまわしてもいいからね',
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
