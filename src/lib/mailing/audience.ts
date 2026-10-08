import type { CrmPersonRole, CrmPriorityTier, Prisma } from '@prisma/client'

/**
 * A group of CRM people described by what they are — contact type,
 * priority, organization, title — for adding to (or taking off) an edition
 * or a list in one go. Within a field the values are alternatives (any of
 * these types); across fields they narrow (an investor AND P0).
 */
export interface AudienceFilter {
  roles: CrmPersonRole[]
  priorities: CrmPriorityTier[]
  /** Comma-separated; matches any current organization containing one of them. */
  orgs: string
  /** Comma-separated; matches any current title containing one of them. */
  titles: string
  /** Your one-to-one email with them, from the Gmail sync. */
  history: EmailHistory
}

/**
 * - emailed: you've sent them at least one email
 * - exchanged: you've emailed them and they've emailed you
 * - no_reply: you've emailed them and they haven't emailed you
 * - never: no one-to-one email either way
 * List sends (Monthly Update etc.) don't count — only real correspondence.
 */
export type EmailHistory = 'any' | 'emailed' | 'exchanged' | 'no_reply' | 'never'
export const EMAIL_HISTORIES: EmailHistory[] = ['any', 'emailed', 'exchanged', 'no_reply', 'never']
export const EMAIL_HISTORY_LABELS: Record<EmailHistory, string> = {
  any: 'Anyone',
  emailed: 'I’ve emailed them',
  exchanged: 'We’ve emailed both ways',
  no_reply: 'Sent, no reply yet',
  never: 'Never emailed',
}

export const EMPTY_AUDIENCE: AudienceFilter = { roles: [], priorities: [], orgs: '', titles: '', history: 'any' }

const terms = (s: string) => s.split(',').map((t) => t.trim()).filter((t) => t.length > 0).slice(0, 20)

export function isEmptyAudience(f: AudienceFilter): boolean {
  return f.roles.length === 0 && f.priorities.length === 0 && terms(f.orgs).length === 0 && terms(f.titles).length === 0 && (f.history ?? 'any') === 'any'
}

const SENT: Prisma.CrmActivityWhereInput = { type: 'EMAIL', direction: 'OUTBOUND', needsReview: false }
const RECEIVED: Prisma.CrmActivityWhereInput = { type: 'EMAIL', direction: 'INBOUND' }

export function historyWhere(h: EmailHistory): Prisma.CrmPersonWhereInput[] {
  if (h === 'emailed') return [{ activities: { some: SENT } }]
  if (h === 'exchanged') return [{ activities: { some: SENT } }, { activities: { some: RECEIVED } }]
  if (h === 'no_reply') return [{ activities: { some: SENT } }, { activities: { none: RECEIVED } }]
  if (h === 'never') return [{ activities: { none: { type: 'EMAIL' } } }]
  return []
}

/**
 * Only people who can actually be emailed: an address on file, and not
 * marked Do not email (pass their ids as `excludeIds`).
 */
export function audienceWhere(f: AudienceFilter, excludeIds: string[] = []): Prisma.CrmPersonWhereInput {
  const and: Prisma.CrmPersonWhereInput[] = [{ email: { not: null } }]
  if (excludeIds.length) and.push({ id: { notIn: excludeIds } })
  and.push(...historyWhere(f.history ?? 'any'))
  if (f.roles.length) and.push({ roles: { hasSome: f.roles } })
  if (f.priorities.length) and.push({ priority: { in: f.priorities } })
  const orgs = terms(f.orgs)
  if (orgs.length) {
    and.push({ affiliations: { some: { isCurrent: true, OR: orgs.map((o) => ({ org: { name: { contains: o, mode: 'insensitive' as const } } })) } } })
  }
  const titles = terms(f.titles)
  if (titles.length) {
    and.push({ affiliations: { some: { isCurrent: true, OR: titles.map((t) => ({ title: { contains: t, mode: 'insensitive' as const } })) } } })
  }
  return { deletedAt: null, AND: and }
}

/** "investors (angel) · P0 or P1 · at Google, Microsoft" — for confirmations and notes. */
export function describeAudience(f: AudienceFilter, roleLabel: (r: CrmPersonRole) => string): string {
  const parts: string[] = []
  if (f.roles.length) parts.push(f.roles.map(roleLabel).join(' or '))
  if (f.priorities.length) parts.push(f.priorities.join(' or '))
  if (terms(f.orgs).length) parts.push(`at ${terms(f.orgs).join(', ')}`)
  if (terms(f.titles).length) parts.push(`titled ${terms(f.titles).join(', ')}`)
  if ((f.history ?? 'any') !== 'any') parts.push(EMAIL_HISTORY_LABELS[f.history].toLowerCase())
  return parts.join(' · ')
}

/** What the in-memory counter needs to know about one emailable person. */
export interface AudienceCandidate {
  roles: CrmPersonRole[]
  priority: CrmPriorityTier | null
  orgs: string[]
  titles: string[]
  sent: number
  received: number
  emailCount: number
}

/** The same test as audienceWhere, on one already-loaded person — for option counts. */
export function matchesAudience(p: AudienceCandidate, f: AudienceFilter): boolean {
  if (f.roles.length && !f.roles.some((r) => p.roles.includes(r))) return false
  if (f.priorities.length && !(p.priority && f.priorities.includes(p.priority))) return false
  const orgs = terms(f.orgs).map((t) => t.toLowerCase())
  if (orgs.length && !p.orgs.some((o) => orgs.some((t) => o.toLowerCase().includes(t)))) return false
  const titles = terms(f.titles).map((t) => t.toLowerCase())
  if (titles.length && !p.titles.some((o) => titles.some((t) => o.toLowerCase().includes(t)))) return false
  const h = f.history ?? 'any'
  if (h === 'emailed' && p.sent === 0) return false
  if (h === 'exchanged' && (p.sent === 0 || p.received === 0)) return false
  if (h === 'no_reply' && (p.sent === 0 || p.received > 0)) return false
  if (h === 'never' && p.emailCount > 0) return false
  return true
}

/** How many each option would give, keeping the other choices. */
export function audienceFacets(people: AudienceCandidate[], f: AudienceFilter, roles: CrmPersonRole[], tiers: CrmPriorityTier[]) {
  const count = (g: AudienceFilter) => people.reduce((n, p) => n + (matchesAudience(p, g) ? 1 : 0), 0)
  return {
    roles: Object.fromEntries(roles.map((r) => [r, count({ ...f, roles: [r] })])) as Record<string, number>,
    priorities: Object.fromEntries(tiers.map((t) => [t, count({ ...f, priorities: [t] })])) as Record<string, number>,
    history: Object.fromEntries(EMAIL_HISTORIES.map((h) => [h, count({ ...f, history: h })])) as Record<string, number>,
  }
}
