import type { AgentConfig } from '../api/types'

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** Client-side sanity checks before PUT /api/agent-config; the server validates again. */
export function validateAgentConfig(c: AgentConfig): string[] {
  const out: string[] = []
  if (!isNum(c.heartbeat_interval_sec) || c.heartbeat_interval_sec < 5) out.push('Heartbeat interval must be at least 5 seconds.')
  if (!isNum(c.inventory_interval_sec) || c.inventory_interval_sec < 0) out.push('Inventory interval must be a positive number.')
  if (!c.batch || !isNum(c.batch.max_events) || c.batch.max_events < 1) out.push('Batch max events must be at least 1.')
  if (!c.batch || !isNum(c.batch.flush_interval_ms) || c.batch.flush_interval_ms < 100) out.push('Batch flush interval must be at least 100 ms.')
  if (!isNum(c.spool_max_bytes) || c.spool_max_bytes < 16 * 1024 * 1024) out.push('Spool limit must be at least 16 MiB.')
  if (!c.fim || !isNum(c.fim.interval_sec) || c.fim.interval_sec < 60) out.push('FIM interval must be at least 60 seconds.')
  if (!c.sensors) out.push('Sensors section is missing.')
  for (const [i, l] of (c.logs ?? []).entries()) if (!l.path?.trim()) out.push(`Log file ${i + 1} needs a path.`)
  for (const [i, f] of (c.filters ?? []).entries()) {
    if (!f.field?.trim()) out.push(`Filter ${i + 1} needs a field.`)
    if (!['equals', 'prefix', 'suffix', 'contains'].includes(f.op)) out.push(`Filter ${i + 1} has an unknown operator.`)
    if (!f.value?.trim()) out.push(`Filter ${i + 1} needs a value.`)
  }
  return out
}
