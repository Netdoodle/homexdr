// Time range math and formatting.

export type RangePreset = '15m' | '1h' | '24h' | '7d'

export type TimeRange = { preset: RangePreset } | { preset: 'custom'; from: string; to: string }

export const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: '15m', label: 'Last 15 minutes' },
  { id: '1h', label: 'Last hour' },
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 days' },
]

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
}

/** Parses "15m", "1h", "7d", "90s", "2w" into milliseconds. Returns null if invalid. */
export function parseDuration(s: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*([smhdw])\s*$/i.exec(s)
  if (!m) return null
  return Math.round(Number(m[1]) * UNIT_MS[m[2].toLowerCase()])
}

export function isPreset(s: string | null | undefined): s is RangePreset {
  return s === '15m' || s === '1h' || s === '24h' || s === '7d'
}

/** Resolves a range to absolute RFC 3339 bounds. Custom ranges are normalized so from <= to. */
export function resolveRange(range: TimeRange, now: number = Date.now()): { from: string; to: string } {
  if (range.preset === 'custom') {
    const a = Date.parse(range.from)
    const b = Date.parse(range.to)
    if (Number.isNaN(a) || Number.isNaN(b)) throw new Error('Invalid custom range')
    const [lo, hi] = a <= b ? [a, b] : [b, a]
    return { from: new Date(lo).toISOString(), to: new Date(hi).toISOString() }
  }
  const ms = parseDuration(range.preset)!
  return { from: new Date(now - ms).toISOString(), to: new Date(now).toISOString() }
}

/** Duration of a range in ms. */
export function rangeDuration(range: TimeRange, now: number = Date.now()): number {
  const { from, to } = resolveRange(range, now)
  return Date.parse(to) - Date.parse(from)
}

/** Serializes a range into URL search params (range=24h, or range=custom&from=&to=). */
export function rangeToParams(range: TimeRange): Record<string, string> {
  if (range.preset === 'custom') return { range: 'custom', from: range.from, to: range.to }
  return { range: range.preset }
}

export function rangeFromParams(sp: URLSearchParams, fallback: RangePreset = '24h'): TimeRange {
  const r = sp.get('range')
  if (r === 'custom') {
    const from = sp.get('from') ?? ''
    const to = sp.get('to') ?? ''
    if (!Number.isNaN(Date.parse(from)) && !Number.isNaN(Date.parse(to))) return { preset: 'custom', from, to }
  }
  if (isPreset(r)) return { preset: r }
  return { preset: fallback }
}

export function describeRange(range: TimeRange): string {
  if (range.preset === 'custom') return `${formatDateTime(range.from)} → ${formatDateTime(range.to)}`
  return RANGE_PRESETS.find((p) => p.id === range.preset)?.label ?? range.preset
}

/** Floors a timestamp (ms) to the start of its UTC hour. */
export function floorHour(ms: number): number {
  return Math.floor(ms / 3_600_000) * 3_600_000
}

/**
 * Returns exactly `hours` hourly buckets ending with the bucket that contains `now`,
 * filling hours missing from `buckets` with zero. Counts of buckets that fall into the
 * same hour are summed; buckets outside the window are dropped.
 */
export function fillHourlyBuckets(
  buckets: { t: string; count: number }[],
  hours: number,
  now: number = Date.now(),
): { t: string; count: number }[] {
  const end = floorHour(now)
  const start = end - (hours - 1) * 3_600_000
  const counts = new Map<number, number>()
  for (const b of buckets) {
    const ms = Date.parse(b.t)
    if (Number.isNaN(ms)) continue
    const h = floorHour(ms)
    if (h < start || h > end) continue
    counts.set(h, (counts.get(h) ?? 0) + b.count)
  }
  const out: { t: string; count: number }[] = []
  for (let h = start; h <= end; h += 3_600_000) {
    out.push({ t: new Date(h).toISOString(), count: counts.get(h) ?? 0 })
  }
  return out
}

/** "just now", "42s ago", "5m ago", "3h ago", "2d ago"; future times as "in 5m". */
export function formatRelative(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const diff = now - t
  const future = diff < 0
  const abs = Math.abs(diff)
  let s: string
  if (abs < 5_000) return 'just now'
  if (abs < 60_000) s = `${Math.floor(abs / 1000)}s`
  else if (abs < 3_600_000) s = `${Math.floor(abs / 60_000)}m`
  else if (abs < 86_400_000) s = `${Math.floor(abs / 3_600_000)}h`
  else if (abs < 30 * 86_400_000) s = `${Math.floor(abs / 86_400_000)}d`
  else return formatDate(iso)
  return future ? `in ${s}` : `${s} ago`
}

const pad = (n: number) => String(n).padStart(2, '0')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Local "Oct 19 14:03:22". */
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Local "2026-10-19 14:03:22.120" for event tables, where ordering matters. */
export function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
  )
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Short axis label for an hourly bucket: "14:00", or "Oct 19" at local midnight. */
export function formatBucketLabel(iso: string, spanHours: number): string {
  const d = new Date(iso)
  if (spanHours > 48) return `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return `${pad(d.getHours())}:00`
}

/** Value for <input type="datetime-local"> in local time. */
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parses a datetime-local value (local time) to RFC 3339 UTC. */
export function fromDatetimeLocal(v: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** "3d 4h", "12m 5s" from seconds. */
export function formatDurationSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s}s`
  return `${s}s`
}
