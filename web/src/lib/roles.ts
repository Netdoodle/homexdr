import type { Role, User } from '../api/types'

const RANK: Record<Role, number> = { viewer: 0, analyst: 1, admin: 2 }

/** True when the user's role is at least `min`. */
export function hasRole(user: User | null | undefined, min: Role): boolean {
  if (!user) return false
  return (RANK[user.role] ?? -1) >= RANK[min]
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  analyst: 'Analyst',
  viewer: 'Viewer',
}

export const ROLE_HELP: Record<Role, string> = {
  admin: 'Everything, including users, rules, tokens and agent config.',
  analyst: 'Triage alerts, search, response actions and hunts.',
  viewer: 'Read-only.',
}
