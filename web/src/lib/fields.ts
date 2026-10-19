// Helpers for reading and summarizing Event JSON.

import type { Event } from '../api/types'
import { resolvePath } from './query'

export { resolvePath }

/** First value at a dotted path, as a display string ('' when absent). */
export function fieldString(obj: unknown, path: string): string {
  if (path === '@timestamp' && obj && typeof obj === 'object') {
    const v = (obj as Record<string, unknown>)['@timestamp']
    return typeof v === 'string' ? v : ''
  }
  const vals = resolvePath(obj, path)
  if (vals.length === 0) return ''
  return vals.map(String).join(', ')
}

/**
 * Leaf paths of a JSON object in ECS dotted form. Array indices are not part of the
 * path (dns.answers.data), matching how the query language addresses fields.
 */
export function leafPaths(obj: unknown, prefix = '', out: Set<string> = new Set()): Set<string> {
  if (obj === null || obj === undefined) return out
  if (Array.isArray(obj)) {
    if (obj.length === 0) return out
    if (obj.every((v) => v === null || typeof v !== 'object')) {
      if (prefix) out.add(prefix)
      return out
    }
    for (const item of obj) leafPaths(item, prefix, out)
    return out
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      leafPaths(v, prefix ? `${prefix}.${k}` : k, out)
    }
    return out
  }
  if (prefix) out.add(prefix)
  return out
}

export function eventCategories(e: Event): string {
  return (e.event?.category ?? []).join(', ')
}

function endpoint(ip?: string, port?: number, domain?: string): string {
  const h = domain || ip || '?'
  return port ? `${h}:${port}` : h
}

/** One-line human summary of an event, derived from its most telling fields. */
export function eventSummary(e: Event): string {
  const cats = e.event?.category ?? []
  const action = e.event?.action ?? ''
  const p = e.process

  if (cats.includes('process') && p) {
    const cmd = p.command_line || p.executable || p.name || ''
    const parent = p.parent?.name ? `${p.parent.name} → ` : ''
    const verb = action && action !== 'exec' && action !== 'start' ? `${action}: ` : ''
    return `${verb}${parent}${cmd}`.trim()
  }
  if (e.dns?.question?.name) {
    const ans = e.dns.resolved_ip?.length ? ` → ${e.dns.resolved_ip.join(', ')}` : ''
    const rc = e.dns.response_code && e.dns.response_code !== 'NOERROR' ? ` [${e.dns.response_code}]` : ''
    return `DNS ${e.dns.question.type ?? ''} ${e.dns.question.name}${ans}${rc}`.replace(/\s+/g, ' ')
  }
  if (cats.includes('intrusion_detection') && e.rule?.name) {
    return `${e.rule.name}${e.source?.ip ? ` · ${endpoint(e.source.ip, e.source.port)} → ${endpoint(e.destination?.ip, e.destination?.port)}` : ''}`
  }
  if (cats.includes('network') && (e.source || e.destination)) {
    const t = e.network?.transport ? `${e.network.transport.toUpperCase()} ` : ''
    const verb = action ? `${action} ` : ''
    return `${verb}${t}${endpoint(e.source?.ip, e.source?.port)} → ${endpoint(
      e.destination?.ip,
      e.destination?.port,
      e.destination?.domain,
    )}`
  }
  if (cats.includes('registry') && e.registry) {
    const data = e.registry.data?.strings?.length ? ` = ${e.registry.data.strings.join(' ')}` : ''
    return `${action || 'registry'} ${e.registry.path ?? e.registry.key ?? ''}${data}`
  }
  if (cats.includes('file') && e.file) {
    const old = e.file.old_path ? `${e.file.old_path} → ` : ''
    return `${action || 'file'} ${old}${e.file.path ?? e.file.name ?? ''}`
  }
  if (cats.includes('library') && e.dll) {
    return `load ${e.dll.path ?? e.dll.name ?? ''}`
  }
  if (cats.includes('authentication')) {
    const u = e.user?.target?.name || e.user?.name || ''
    const src = e.source?.ip ? ` from ${e.source.ip}` : ''
    const outcome = e.event?.outcome ? ` (${e.event.outcome})` : ''
    return e.message || `${action || 'logon'} ${u}${src}${outcome}`
  }
  if (e.message) return e.message
  if (e.service?.name) return `${action || 'service'} ${e.service.name}`
  return action || e.event?.dataset || e.event?.kind || ''
}

/** Process entity of an event, if any (for "open process tree" links). */
export function eventProcessEntity(e: Event): string | undefined {
  return e.process?.entity_id
}

export const DEFAULT_SEARCH_COLUMNS = ['@timestamp', 'host.name', 'event.category', 'event.action', 'process.name', 'summary']

/** Fields offered in the column chooser even before results load. */
export const COMMON_FIELDS = [
  '@timestamp',
  'host.name',
  'event.category',
  'event.type',
  'event.action',
  'event.outcome',
  'event.module',
  'event.dataset',
  'event.code',
  'process.name',
  'process.pid',
  'process.executable',
  'process.command_line',
  'process.user.name',
  'process.parent.name',
  'process.hash.sha256',
  'user.name',
  'source.ip',
  'source.port',
  'destination.ip',
  'destination.port',
  'destination.domain',
  'network.transport',
  'network.direction',
  'dns.question.name',
  'file.path',
  'registry.path',
  'rule.name',
  'message',
  'summary',
]

export const COLUMN_LABELS: Record<string, string> = {
  '@timestamp': 'Time',
  'host.name': 'Host',
  'event.category': 'Category',
  'event.action': 'Action',
  'process.name': 'Process',
  summary: 'Summary',
}
