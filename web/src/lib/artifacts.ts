// Artifact parameter helpers: defaults, validation and normalization to the
// Record<string, string> the API expects.

import type { ArtifactDef } from '../api/types'

export function artifactDefaults(def: ArtifactDef): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of def.params ?? []) out[p.name] = p.default ?? (p.type === 'bool' ? 'false' : '')
  return out
}

/** Returns a map of param name → error message; empty when valid. */
export function validateArtifactParams(def: ArtifactDef, values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const p of def.params ?? []) {
    const v = (values[p.name] ?? '').trim()
    if (!v) {
      if (p.required) errors[p.name] = 'Required'
      continue
    }
    if (p.type === 'int' && !/^-?\d+$/.test(v)) errors[p.name] = 'Must be a whole number'
    if (p.type === 'bool' && v !== 'true' && v !== 'false') errors[p.name] = 'Must be true or false'
  }
  return errors
}

/** Drops empty values and values equal to the default, so the agent applies its defaults. */
export function normalizeArtifactParams(def: ArtifactDef, values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of def.params ?? []) {
    const v = (values[p.name] ?? '').trim()
    if (!v) continue
    if (!p.required && p.default !== undefined && v === p.default) continue
    out[p.name] = v
  }
  return out
}

export function artifactsForPlatform(defs: ArtifactDef[], platform: string): ArtifactDef[] {
  return defs.filter((d) => d.platforms.includes(platform))
}
