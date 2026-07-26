import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Rule, RuleTrigger } from '../../types'
import { formatNightTime, parseNightTime } from '../../lib/time'
import { useRules } from '../../hooks/useRules'

type TriggerKind = RuleTrigger['type']

type FormState = {
  kind: TriggerKind
  taskName: string
  at: string
  action: string
}

const EMPTY_FORM: FormState = {
  kind: 'FREE_TIME',
  taskName: '',
  at: '',
  action: '',
}

const TRIGGER_LABELS: { kind: TriggerKind; label: string }[] = [
  { kind: 'FREE_TIME', label: '自由時間になったら' },
  { kind: 'TASK_START', label: 'このタスクを始めるとき' },
  { kind: 'ALL_DONE', label: 'ぜんぶ終わったら' },
  { kind: 'TIME', label: 'この時刻を過ぎたら' },
]

/** 「例を入れる」で投入する初期セット(docs/handover-schedule-planner.md §5 を Web で検知できる形に置き換えたもの) */
const EXAMPLES: { trigger: RuleTrigger; action: string }[] = [
  {
    trigger: { type: 'FREE_TIME' },
    action: '見るなら 10分タイマーをかけてから開く',
  },
  {
    trigger: { type: 'ALL_DONE' },
    action: '何を見るか先に決めてから開く',
  },
  {
    trigger: { type: 'TIME', at: 1350 }, // 22:30
    action: 'いま見ている 1本を見終えて終了する',
  },
]

function describeTrigger(trigger: RuleTrigger): string {
  switch (trigger.type) {
    case 'FREE_TIME':
      return 'もし 自由時間になったら'
    case 'ALL_DONE':
      return 'もし ぜんぶ終わったら'
    case 'TASK_START':
      return `もし ${trigger.taskName} を始めるとき`
    case 'TIME':
      return `もし ${formatNightTime(trigger.at)} を過ぎたら`
  }
}

export function RulesTab() {
  const { rules, add, update, remove, move } = useRules()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const at = form.kind === 'TIME' ? parseNightTime(form.at) : undefined
  const actionInvalid = form.action.trim() === ''
  const taskNameInvalid = form.kind === 'TASK_START' && form.taskName.trim() === ''
  const atInvalid = form.kind === 'TIME' && at == null
  const canSubmit = !actionInvalid && !taskNameInvalid && !atInvalid

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function buildTrigger(): RuleTrigger | null {
    switch (form.kind) {
      case 'FREE_TIME':
        return { type: 'FREE_TIME' }
      case 'ALL_DONE':
        return { type: 'ALL_DONE' }
      case 'TASK_START':
        return { type: 'TASK_START', taskName: form.taskName.trim() }
      case 'TIME':
        return at != null ? { type: 'TIME', at } : null
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trigger = buildTrigger()
    if (!canSubmit || trigger === null) return
    const input = { trigger, action: form.action.trim() }
    if (editingId) {
      update(editingId, input)
    } else {
      add(input)
    }
    resetForm()
  }

  function startEdit(rule: Rule) {
    setEditingId(rule.id)
    setForm({
      kind: rule.trigger.type,
      taskName: rule.trigger.type === 'TASK_START' ? rule.trigger.taskName : '',
      at: rule.trigger.type === 'TIME' ? formatNightTime(rule.trigger.at) : '',
      action: rule.action,
    })
  }

  function handleDelete(rule: Rule) {
    if (!window.confirm(`「${rule.action}」を削除しますか?`)) return
    remove(rule.id)
    if (editingId === rule.id) resetForm()
  }

  return (
    <section>
      <h2>きめごと</h2>
      <p className="hint">
        「もし◯◯なら、△△する」の形で決めておくと、その場面でミニキャラがそのまま声をかけます。
        時刻の合図より、動作を書くほうが効きます
      </p>

      {rules.length === 0 ? (
        <>
          <p className="placeholder">
            まだきめごとがありません。下のフォームから登録してください。
          </p>
          <div className="button-row">
            <button
              type="button"
              onClick={() => {
                for (const e of EXAMPLES) add(e)
              }}
            >
              例を入れてみる
            </button>
          </div>
        </>
      ) : (
        <ul className="routine-list">
          {rules.map((rule, i) => (
            <li key={rule.id} className="routine-row">
              <div className="routine-main">
                <span className="routine-meta">{describeTrigger(rule.trigger)}</span>
                <span className="routine-name">{rule.action}</span>
              </div>
              <div className="routine-actions">
                <button
                  type="button"
                  aria-label={`${rule.action} を上へ`}
                  disabled={i === 0}
                  onClick={() => move(rule.id, -1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`${rule.action} を下へ`}
                  disabled={i === rules.length - 1}
                  onClick={() => move(rule.id, 1)}
                >
                  ▼
                </button>
                <button
                  type="button"
                  aria-label={`${rule.action} を編集`}
                  onClick={() => startEdit(rule)}
                >
                  編集
                </button>
                <button
                  type="button"
                  aria-label={`${rule.action} を削除`}
                  onClick={() => handleDelete(rule)}
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="routine-form" onSubmit={handleSubmit}>
        <h3>{editingId ? 'きめごとを編集' : 'きめごとを追加'}</h3>

        <div className="field">
          <label htmlFor="rule-trigger">きっかけ</label>
          <select
            id="rule-trigger"
            value={form.kind}
            onChange={(e) =>
              setForm({ ...form, kind: e.target.value as TriggerKind })
            }
          >
            {TRIGGER_LABELS.map((t) => (
              <option key={t.kind} value={t.kind}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {form.kind === 'TASK_START' && (
          <div className="field">
            <label htmlFor="rule-task">タスク名</label>
            <p className="hint">ルーチンと同じ名前にすると、そのタスクの番で出ます</p>
            <input
              id="rule-task"
              value={form.taskName}
              onChange={(e) => setForm({ ...form, taskName: e.target.value })}
            />
          </div>
        )}

        {form.kind === 'TIME' && (
          <div className="field">
            <label htmlFor="rule-at">時刻</label>
            <p className="hint">
              2230 のようにコロンなしでも可(深夜 0 時越えは 2430 = 24:30)
            </p>
            <input
              id="rule-at"
              className="time-input"
              inputMode="numeric"
              placeholder="22:30"
              value={form.at}
              onChange={(e) => setForm({ ...form, at: e.target.value })}
            />
            {form.at.trim() !== '' && atInvalid && (
              <p className="field-error" role="alert">
                時刻を読み取れません。2230 か 22:30 のように入力してください
              </p>
            )}
          </div>
        )}

        <div className="field">
          <label htmlFor="rule-action">そのときやること</label>
          <p className="hint">
            動詞で書くのがコツ(例: 10分タイマーをかけてから開く)。この一文がそのままセリフになります
          </p>
          <input
            id="rule-action"
            value={form.action}
            onChange={(e) => setForm({ ...form, action: e.target.value })}
          />
        </div>

        <div className="button-row">
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {editingId ? '更新' : '追加'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              キャンセル
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
