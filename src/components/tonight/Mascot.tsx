import type { MascotLine, MascotMood } from '../../lib/mascot'

type Props = { line: MascotLine }

/**
 * 実行ビューでしゃべるミニキャラ(ひよこ)。
 * 画像は使わずインライン SVG で描く(オフライン・ダークモード対応のため)。
 * セリフは now カード等と同じ情報なので、読み上げの二重化を避けて装飾扱いにする。
 */
export function Mascot({ line }: Props) {
  return (
    <div className={`mascot mascot-${line.mood}`} aria-hidden="true">
      <Chick mood={line.mood} />
      {/* key でセリフが変わるたびに吹き出しのポップを再生する */}
      <p className="mascot-bubble" key={line.text}>
        {line.ruleId !== undefined && (
          <span className="mascot-tag">きめごと</span>
        )}
        {line.text}
      </p>
    </div>
  )
}

function Chick({ mood }: { mood: MascotMood }) {
  return (
    <svg className="mascot-svg" viewBox="0 0 88 88" focusable="false">
      {/* 足 */}
      <g
        stroke="#ef9008"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M36 70v9M31 82l5-3 5 3" />
        <path d="M52 70v9M47 82l5-3 5 3" />
      </g>

      <g className="mascot-body">
        {/* 頭のぴょこ毛 */}
        <path
          d="M44 20c-2-6 0-11 4-13-2 4-1 8 2 10z"
          fill="#ffd75e"
          stroke="#f0b429"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* 羽(左右でひらひらする) */}
        <ellipse
          className="mascot-wing mascot-wing-l"
          cx="17"
          cy="50"
          rx="7"
          ry="11"
          fill="#ffcc4d"
          stroke="#f0b429"
          strokeWidth="1.5"
        />
        <ellipse
          className="mascot-wing mascot-wing-r"
          cx="71"
          cy="50"
          rx="7"
          ry="11"
          fill="#ffcc4d"
          stroke="#f0b429"
          strokeWidth="1.5"
        />
        {/* 胴体 */}
        <ellipse
          cx="44"
          cy="46"
          rx="29"
          ry="27"
          fill="#ffd75e"
          stroke="#f0b429"
          strokeWidth="1.8"
        />
        {/* ほっぺ */}
        <ellipse cx="27" cy="52" rx="6" ry="4" fill="#ff9db0" opacity="0.6" />
        <ellipse cx="61" cy="52" rx="6" ry="4" fill="#ff9db0" opacity="0.6" />
        <Beak mood={mood} />
        <Eyes mood={mood} />
      </g>

      <Decoration mood={mood} />
    </svg>
  )
}

function Eyes({ mood }: { mood: MascotMood }) {
  const ink = '#4a3410'

  if (mood === 'rest' || mood === 'done') {
    // ^ ^ (にっこり)
    return (
      <g stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M29 44q5-7 10 0" />
        <path d="M49 44q5-7 10 0" />
      </g>
    )
  }

  if (mood === 'hurry') {
    // > < (必死)
    return (
      <g
        stroke={ink}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M30 38l7 4.5-7 4.5" />
        <path d="M58 38l-7 4.5 7 4.5" />
      </g>
    )
  }

  if (mood === 'sleepy') {
    // 閉じた目
    return (
      <g stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M29 41q5 6 10 0" />
        <path d="M49 41q5 6 10 0" />
      </g>
    )
  }

  // go / idle: 丸目。ときどきまばたきする
  const r = mood === 'idle' ? 3.2 : 4.2
  return (
    <g className="mascot-eyes">
      <circle cx="34" cy="42" r={r} fill={ink} />
      <circle cx="54" cy="42" r={r} fill={ink} />
      <circle cx="35.5" cy="40.4" r="1.3" fill="#fff" />
      <circle cx="55.5" cy="40.4" r="1.3" fill="#fff" />
    </g>
  )
}

function Beak({ mood }: { mood: MascotMood }) {
  const open = mood === 'go' || mood === 'done' || mood === 'hurry'

  if (open) {
    // しゃべっている口(上下に分かれたくちばし)
    return (
      <g fill="#ef9008" className="mascot-beak">
        <path d="M38 51h12l-6 4z" />
        <path d="M39.5 56.5h9L44 61z" />
      </g>
    )
  }
  return <path d="M38.5 50h11l-5.5 6.5z" fill="#ef9008" />
}

function Decoration({ mood }: { mood: MascotMood }) {
  if (mood === 'done') {
    // キラキラ
    return (
      <g className="mascot-deco" fill="#ffc531">
        <path d="M13 21l1.7 4.6 4.6 1.7-4.6 1.7L13 33.6l-1.7-4.6L6.7 27.3l4.6-1.7z" />
        <path d="M75 13l1.3 3.5 3.5 1.3-3.5 1.3L75 22.6l-1.3-3.5-3.5-1.3 3.5-1.3z" />
      </g>
    )
  }

  if (mood === 'hurry') {
    // 汗
    return (
      <path
        className="mascot-deco"
        d="M71 24c3 4.2 4.6 6.3 4.6 8a4.6 4.6 0 11-9.2 0c0-1.7 1.6-3.8 4.6-8z"
        fill="#6ec8ff"
      />
    )
  }

  if (mood === 'sleepy') {
    return (
      <g
        className="mascot-deco"
        fill="#9aa4af"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
      >
        <text x="64" y="26" fontSize="11">
          z
        </text>
        <text x="73" y="16" fontSize="14">
          z
        </text>
      </g>
    )
  }

  return null
}
