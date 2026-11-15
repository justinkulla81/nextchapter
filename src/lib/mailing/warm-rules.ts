/**
 * Who counts as warm for sending order (owner rules, 2026-11-11 and 2026-11-13). Pure, so the send job and the tests agree.
 *
 * Warm: the person engaged with earlier list mail (a human open, click or reply), or they are a contact we know: not
 * Hunter-sourced, and CRM warmth HOT or WARM, or a LinkedIn connection. Everyone else is cold: they share the cold daily cap.
 */
export interface WarmFacts {
  warmth: string
  emailSource: string | null
  linkedinDegree: string | null
  connected: boolean
  engagedBefore: boolean
}

export function isHunterSourced(emailSource: string | null): boolean {
  return !!emailSource && emailSource.toLowerCase().startsWith('hunter')
}

export function isWarmPerson(f: WarmFacts): boolean {
  if (f.engagedBefore) return true
  if (isHunterSourced(f.emailSource)) return false
  return f.warmth === 'HOT' || f.warmth === 'WARM' || f.connected || /^1/.test(f.linkedinDegree ?? '')
}
