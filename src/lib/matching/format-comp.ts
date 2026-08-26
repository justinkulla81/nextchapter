import type { CompArrangement } from '@prisma/client'

// Shared by MatchedRoleList (UI) and the role-match email template, so a
// role's comp reads identically wherever it's shown.
export function formatRoleComp(role: { compArrangement: CompArrangement; compMin: number | null; compMax: number | null }): string {
  if (role.compArrangement === 'UNPAID') return 'Unpaid'
  if (role.compArrangement === 'OPEN_TO_DISCUSS') return 'Open to discuss'
  if (role.compMin && role.compMax) return `$${role.compMin.toLocaleString()} – $${role.compMax.toLocaleString()}`
  if (role.compMin) return `From $${role.compMin.toLocaleString()}`
  if (role.compMax) return `Up to $${role.compMax.toLocaleString()}`
  return 'Not specified'
}
