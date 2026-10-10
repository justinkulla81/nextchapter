import { strictOrgKey } from '@/lib/crm/normalize'
import { normalizeOrgName } from '@/lib/text/org-name-match'

/**
 * Matching a search firm to a CRM organization — pure, so it is tested
 * without a database.
 *
 * Only two things count as the same organization: the same name (the strict
 * key every other CRM path matches on) or the same web/email domain. A name
 * that differs only by a tagline ("Bridge Partners - Executive Search") or by
 * one generic word ("Caldwell" for "Caldwell Partners") is probably the same
 * firm, but probably is a guess — that goes to the Review List for a person
 * to decide, never merged here.
 */

export interface OrgForMatch {
  id: string
  name: string
  website: string | null
  emailDomain: string | null
}

export type FirmMatch =
  | { kind: 'matched'; orgId: string; basis: 'name' | 'domain' }
  | { kind: 'review'; orgId: string; reason: string }
  | { kind: 'none' }

/** "https://www.imsearch.com/about" → "imsearch.com". */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null
  const host = url.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/^www\./, '')
  return host.includes('.') ? host : null
}

// Words a search firm's name carries that say what it is rather than which
// one it is. Removing them is how "Caldwell Partners" and "Caldwell" meet.
const GENERIC = new Set([
  'partners', 'partner', 'group', 'associates', 'search', 'executive', 'international', 'global',
  'consulting', 'consultants', 'company', 'co', 'and', '&', 'partnership', 'advisors', 'network',
  'recruiting', 'recruitment', 'resources', 'leadership', 'talent', 'solutions', 'firm',
])

/** The strict key with any tagline (" - …", " | …", ": …") cut off. */
export function firmKey(name: string): string {
  const cut = name.split(/\s+[-–—|]\s+|\s*\|\s*|:\s+/)[0] || name
  return strictOrgKey(cut, normalizeOrgName)
}

/** The distinctive words left once generic ones are gone: "caldwell". */
export function coreKey(name: string): string {
  return firmKey(name).split(' ').filter((w) => w && !GENERIC.has(w)).join(' ')
}

export function matchFirmToOrgs(
  firm: { name: string; website?: string | null; domain?: string | null },
  orgs: OrgForMatch[],
): FirmMatch {
  const exact = strictOrgKey(firm.name, normalizeOrgName)
  const byName = orgs.find((o) => strictOrgKey(o.name, normalizeOrgName) === exact)
  if (byName) return { kind: 'matched', orgId: byName.id, basis: 'name' }

  const domain = firm.domain ?? domainOf(firm.website)
  if (domain) {
    const byDomain = orgs.find((o) => o.emailDomain === domain || domainOf(o.website) === domain)
    if (byDomain) return { kind: 'matched', orgId: byDomain.id, basis: 'domain' }
  }

  const tagless = firmKey(firm.name)
  const byTagless = orgs.find((o) => firmKey(o.name) === tagless)
  if (byTagless) return { kind: 'review', orgId: byTagless.id, reason: `Same name apart from a tagline: "${byTagless.name}"` }

  // A core of one short word ("true", "atlas") is too common to suggest anything.
  const core = coreKey(firm.name)
  if (core.length >= 5 || core.includes(' ')) {
    const byCore = orgs.find((o) => coreKey(o.name) === core)
    if (byCore) return { kind: 'review', orgId: byCore.id, reason: `Same name apart from generic words: "${byCore.name}"` }
  }
  // A shortened name in the CRM ("Odgers" for "Odgers Berndtson") — only when
  // the CRM's is the shorter one and distinctive enough (6+ letters); the other
  // way round, "Morgan" would pull in Morgan Stanley.
  const short = orgs.find((o) => {
    const c = coreKey(o.name)
    return c.length >= 6 && !c.includes(' ') && core.startsWith(`${c} `)
  })
  if (short) return { kind: 'review', orgId: short.id, reason: `A shortened form of the name: "${short.name}"` }
  return { kind: 'none' }
}

export type FirmSegment = 'retained' | 'contingent' | 'nonprofit_higher_ed'

export const SEGMENT_LABEL: Record<FirmSegment, string> = {
  retained: 'Retained executive search',
  contingent: 'Contingent professional recruiting',
  nonprofit_higher_ed: 'Nonprofit / higher-ed search',
}

// Firms whose model is known — by ncrawl source id. Anything else falls back
// to the name, then to retained (most of the list is retained exec search).
const KNOWN_SEGMENT: Record<string, FirmSegment> = {
  'sf:isaacsonmiller': 'nonprofit_higher_ed',
  'sf:academicsearch': 'nonprofit_higher_ed',
  'sf:carneysandoe': 'nonprofit_higher_ed',
  'sf:dhrnonprofit': 'nonprofit_higher_ed',
  'sf:nonprofithr': 'nonprofit_higher_ed',
  'sf:wittkieffer': 'nonprofit_higher_ed',
  'sf:storbeck': 'nonprofit_higher_ed',
  'sf:greenwoodasher': 'nonprofit_higher_ed',
  'sf:agbsearch': 'nonprofit_higher_ed',
  'sf:perrettlaver': 'nonprofit_higher_ed',
  'sf:diversifiedsearch': 'nonprofit_higher_ed',
  'sf:mrinetwork': 'contingent',
  'sf:solomonpage': 'contingent',
  'sf:kayebassman': 'contingent',
  'sf:sanfordrose': 'contingent',
  'sf:lafosse': 'contingent',
  'sf:kleinhersh': 'contingent',
  'sf:directrecruiters': 'contingent',
  'sf:searchwide': 'contingent',
  'sf:smithwilkinson': 'contingent',
}

export function segmentFor(sourceKey: string, name: string, hint?: string | null): FirmSegment {
  if (KNOWN_SEGMENT[sourceKey]) return KNOWN_SEGMENT[sourceKey]
  const h = (hint ?? '').toLowerCase()
  if (/nonprofit|non-profit|higher.?ed|academic|education|university|school|foundation/.test(`${h} ${name.toLowerCase()}`)) return 'nonprofit_higher_ed'
  if (/contingen|staffing|recruit/.test(h) || /\b(staffing|recruiters?|recruitment)\b/i.test(name)) return 'contingent'
  return 'retained'
}

/**
 * How useful a title is to this pitch, lower first: the person who decides
 * to send searches (managing partner, MD), then partners, then research,
 * then the recruiters who run searches. -1 means not a contact for this.
 */
export function contactRank(title: string | null | undefined): number {
  const t = (title ?? '').toLowerCase()
  if (!t) return -1
  if (/\b(ceo|chief executive|president|founder|managing partner|chair(man|woman)?)\b/.test(t)) return 0
  if (/\bmanaging director\b|\bregional (managing )?director\b/.test(t)) return 1
  if (/\b(senior |executive )?partner\b|\bprincipal\b|\bpractice (leader|head)\b/.test(t)) return 2
  if (/\b(research|sourcing)\b/.test(t)) return 3
  if (/\b(recruit\w*|consultant|search|talent|director|vice president|vp)\b/.test(t)) return 4
  return -1
}
