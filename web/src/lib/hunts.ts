import type { ArtifactDef, Host, HuntTarget } from '../api/types'

/** Client-side preview of which hosts a hunt target selects (the server decides for real). */
export function huntTargetHosts(hosts: Host[], target: HuntTarget, artifact?: ArtifactDef): Host[] {
  return hosts.filter((h) => {
    if (h.kind !== 'endpoint' || h.status === 'revoked') return false
    if (artifact && !artifact.platforms.includes(h.os.platform)) return false
    if (target.all) return true
    if (target.labels?.length && target.labels.some((l) => h.labels.includes(l))) return true
    if (target.host_ids?.length && target.host_ids.includes(h.id)) return true
    if (target.platform && h.os.platform === target.platform) return true
    return false
  })
}

export function describeTarget(t: HuntTarget, hostName?: (id: string) => string): string {
  const parts: string[] = []
  if (t.all) return 'All hosts'
  if (t.labels?.length) parts.push(`labels ${t.labels.join(', ')}`)
  if (t.host_ids?.length) parts.push(t.host_ids.length <= 3 && hostName ? t.host_ids.map(hostName).join(', ') : `${t.host_ids.length} hosts`)
  if (t.platform) parts.push(`platform ${t.platform}`)
  return parts.join(' · ') || 'No hosts'
}
