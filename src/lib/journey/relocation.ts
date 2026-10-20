// How far a member will go for a job. Pure and client-safe. "Open to relocation"
// as a yes/no hid the real answer: stay in my area, widen the commute radius,
// move to particular states, or go anywhere. Stored in journeyDetails.relocation;
// the old openToRelocation boolean stays in step (true unless "stay local") so
// every reader that only knows yes/no keeps working.

export const RELOCATION_SCOPES = [
  { key: 'LOCAL', label: 'Stay where I live', hint: 'My area only, or remote.' },
  { key: 'RADIUS', label: 'A wider area', hint: 'Commute or move within a distance.' },
  { key: 'STATES', label: 'Particular states', hint: 'I will move to the states I pick.' },
  { key: 'ANYWHERE', label: 'Anywhere', hint: 'For the right role.' },
] as const
export type RelocationScope = (typeof RELOCATION_SCOPES)[number]['key']

export const RADIUS_OPTIONS = [25, 50, 100, 250] as const

export type Relocation = { scope: RelocationScope; radiusMiles?: number; states?: string[] }

const STATE = /^[A-Z]{2}$/

export function parseRelocation(details: unknown, openToRelocation: boolean): Relocation {
  const v = (details as { relocation?: Partial<Relocation> } | null)?.relocation
  if (v && RELOCATION_SCOPES.some((s) => s.key === v.scope)) {
    const states = Array.isArray(v.states) ? v.states.filter((s): s is string => typeof s === 'string' && STATE.test(s)) : []
    return {
      scope: v.scope as RelocationScope,
      ...(v.scope === 'RADIUS' ? { radiusMiles: RADIUS_OPTIONS.find((o) => o === v.radiusMiles) ?? 50 } : {}),
      ...(v.scope === 'STATES' ? { states } : {}),
    }
  }
  // Nothing saved yet: the old yes/no.
  return { scope: openToRelocation ? 'ANYWHERE' : 'LOCAL' }
}

// What the form sent, made safe. A states answer with no states is "stay where I live".
export function buildRelocation(input: { scope?: string | null; radiusMiles?: number | null; states?: string[] }): Relocation {
  const scope = RELOCATION_SCOPES.find((s) => s.key === input.scope)?.key ?? 'LOCAL'
  if (scope === 'RADIUS') {
    const r = RADIUS_OPTIONS.find((o) => o === input.radiusMiles) ?? 50
    return { scope, radiusMiles: r }
  }
  if (scope === 'STATES') {
    const states = [...new Set((input.states ?? []).map((s) => s.toUpperCase()).filter((s) => STATE.test(s)))].sort()
    return states.length > 0 ? { scope, states } : { scope: 'LOCAL' }
  }
  return { scope }
}

export const opensToMove = (r: Relocation): boolean => r.scope !== 'LOCAL'

// A job in a state other than home: would this member move there?
// RADIUS cannot be measured without distances, so it covers the home state only.
export function wouldMoveTo(r: Relocation, jobState: string, homeState: string | null): boolean {
  if (homeState && jobState === homeState) return true
  switch (r.scope) {
    case 'ANYWHERE':
      return true
    case 'STATES':
      return !!r.states?.includes(jobState)
    default:
      return false
  }
}

export function describeRelocation(r: Relocation): string {
  switch (r.scope) {
    case 'LOCAL':
      return 'staying where you live (remote roles included)'
    case 'RADIUS':
      return `within about ${r.radiusMiles ?? 50} miles`
    case 'STATES':
      return `moving to ${(r.states ?? []).join(', ')}`
    case 'ANYWHERE':
      return 'anywhere for the right role'
  }
}
