import { useState } from 'react'
import {
  RANGE_PRESETS,
  fromDatetimeLocal,
  resolveRange,
  toDatetimeLocal,
  type TimeRange,
} from '../lib/time'
import { Icon } from './Icon'

/** 15m / 1h / 24h / 7d buttons plus a custom from/to editor. */
export function TimeRangePicker({ value, onChange }: { value: TimeRange; onChange: (r: TimeRange) => void }) {
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom')
  const initial = resolveRange(value)
  const [from, setFrom] = useState(toDatetimeLocal(initial.from))
  const [to, setTo] = useState(toDatetimeLocal(initial.to))

  const fromIso = fromDatetimeLocal(from)
  const toIso = fromDatetimeLocal(to)
  const customInvalid = !fromIso || !toIso || Date.parse(fromIso) >= Date.parse(toIso)

  return (
    <div className="row">
      <div className="btn-group" role="group" aria-label="Time range">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={value.preset === p.id && !customOpen ? 'btn active' : 'btn'}
            title={p.label}
            onClick={() => {
              setCustomOpen(false)
              onChange({ preset: p.id })
            }}
          >
            {p.id}
          </button>
        ))}
        <button
          type="button"
          className={customOpen || value.preset === 'custom' ? 'btn active' : 'btn'}
          onClick={() => {
            if (!customOpen) {
              const r = resolveRange(value)
              setFrom(toDatetimeLocal(r.from))
              setTo(toDatetimeLocal(r.to))
            }
            setCustomOpen(!customOpen)
          }}
          aria-expanded={customOpen}
        >
          <Icon name="clock" size={14} /> Custom
        </button>
      </div>
      {customOpen ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            if (!customInvalid && fromIso && toIso) onChange({ preset: 'custom', from: fromIso, to: toIso })
          }}
        >
          <input
            type="datetime-local"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="From"
          />
          <span className="muted">→</span>
          <input type="datetime-local" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          <button type="submit" className="btn primary sm" disabled={customInvalid}>
            Apply
          </button>
        </form>
      ) : null}
    </div>
  )
}
