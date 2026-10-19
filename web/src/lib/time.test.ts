import { describe, expect, it } from 'vitest'
import {
  fillHourlyBuckets,
  floorHour,
  formatDurationSec,
  formatRelative,
  fromDatetimeLocal,
  parseDuration,
  rangeDuration,
  rangeFromParams,
  rangeToParams,
  resolveRange,
  toDatetimeLocal,
} from './time'

const NOW = Date.parse('2026-10-19T14:37:12.000Z')

describe('durations', () => {
  it('parses preset strings', () => {
    expect(parseDuration('15m')).toBe(15 * 60_000)
    expect(parseDuration('1h')).toBe(3_600_000)
    expect(parseDuration('7d')).toBe(7 * 86_400_000)
    expect(parseDuration('2w')).toBe(14 * 86_400_000)
    expect(parseDuration('1.5h')).toBe(5_400_000)
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('10')).toBeNull()
  })

  it('formats seconds compactly', () => {
    expect(formatDurationSec(42)).toBe('42s')
    expect(formatDurationSec(125)).toBe('2m 5s')
    expect(formatDurationSec(3 * 3600 + 120)).toBe('3h 2m')
    expect(formatDurationSec(2 * 86400 + 5 * 3600)).toBe('2d 5h')
    expect(formatDurationSec(-1)).toBe('—')
  })
})

describe('resolveRange', () => {
  it('resolves presets relative to now', () => {
    expect(resolveRange({ preset: '15m' }, NOW)).toEqual({ from: '2026-10-19T14:22:12.000Z', to: '2026-10-19T14:37:12.000Z' })
    expect(resolveRange({ preset: '7d' }, NOW).from).toBe('2026-10-12T14:37:12.000Z')
    expect(rangeDuration({ preset: '24h' }, NOW)).toBe(86_400_000)
  })

  it('normalizes reversed custom ranges', () => {
    const r = resolveRange({ preset: 'custom', from: '2026-10-19T12:00:00Z', to: '2026-10-19T10:00:00Z' })
    expect(r).toEqual({ from: '2026-10-19T10:00:00.000Z', to: '2026-10-19T12:00:00.000Z' })
  })

  it('rejects invalid custom ranges', () => {
    expect(() => resolveRange({ preset: 'custom', from: 'nope', to: '2026-10-19T10:00:00Z' })).toThrow()
  })

  it('round-trips through URL params', () => {
    const custom = { preset: 'custom' as const, from: '2026-10-19T10:00:00.000Z', to: '2026-10-19T12:00:00.000Z' }
    expect(rangeFromParams(new URLSearchParams(rangeToParams(custom)))).toEqual(custom)
    expect(rangeFromParams(new URLSearchParams(rangeToParams({ preset: '1h' })))).toEqual({ preset: '1h' })
    expect(rangeFromParams(new URLSearchParams('range=bogus'), '7d')).toEqual({ preset: '7d' })
    expect(rangeFromParams(new URLSearchParams('range=custom&from=x&to=y'))).toEqual({ preset: '24h' })
  })
})

describe('fillHourlyBuckets', () => {
  it('returns exactly N hourly buckets ending at the current hour, zero-filled', () => {
    const out = fillHourlyBuckets([{ t: '2026-10-19T13:00:00Z', count: 5 }], 3, NOW)
    expect(out).toEqual([
      { t: '2026-10-19T12:00:00.000Z', count: 0 },
      { t: '2026-10-19T13:00:00.000Z', count: 5 },
      { t: '2026-10-19T14:00:00.000Z', count: 0 },
    ])
  })

  it('sums buckets in the same hour and drops ones outside the window', () => {
    const out = fillHourlyBuckets(
      [
        { t: '2026-10-19T14:05:00Z', count: 2 },
        { t: '2026-10-19T14:59:59Z', count: 3 },
        { t: '2026-10-18T01:00:00Z', count: 99 },
        { t: 'garbage', count: 1 },
      ],
      2,
      NOW,
    )
    expect(out.map((b) => b.count)).toEqual([0, 5])
  })

  it('floors to UTC hours', () => {
    expect(new Date(floorHour(NOW)).toISOString()).toBe('2026-10-19T14:00:00.000Z')
  })
})

describe('formatRelative', () => {
  it('describes past and future times', () => {
    expect(formatRelative(new Date(NOW - 2000).toISOString(), NOW)).toBe('just now')
    expect(formatRelative(new Date(NOW - 42_000).toISOString(), NOW)).toBe('42s ago')
    expect(formatRelative(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5m ago')
    expect(formatRelative(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe('3h ago')
    expect(formatRelative(new Date(NOW - 2 * 86_400_000).toISOString(), NOW)).toBe('2d ago')
    expect(formatRelative(new Date(NOW + 10 * 60_000).toISOString(), NOW)).toBe('in 10m')
    expect(formatRelative(undefined, NOW)).toBe('—')
  })
})

describe('datetime-local conversion', () => {
  it('round-trips local wall-clock time', () => {
    const iso = fromDatetimeLocal('2026-10-19T08:30')!
    expect(toDatetimeLocal(iso)).toBe('2026-10-19T08:30')
    expect(fromDatetimeLocal('not a date')).toBeNull()
  })
})
