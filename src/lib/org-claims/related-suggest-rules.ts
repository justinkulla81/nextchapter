// Related organizations, pure parts: turning what we know about an organization's region (its board, job centers, member companies, the
// employers hiring near it, the colleges near it) into a short, grouped list of organizations it probably knows. No database here.

export const SUGGEST_GROUPS = [
  { key: 'PEERS', label: 'Organizations like yours' },
  { key: 'EMPLOYERS', label: 'Employers' },
  { key: 'HIGHER_ED', label: 'Colleges and universities' },
] as const
export type SuggestGroup = (typeof SUGGEST_GROUPS)[number]['key']

/** How many of each group to show. A long list stops being a choice. */
export const GROUP_CAP: Record<SuggestGroup, number> = { PEERS: 10, EMPLOYERS: 12, HIGHER_ED: 8 }

/** Something we think the organization knows, by the names it may be stored under (normalized), and why. */
export type Candidate = { group: SuggestGroup; keys: string[]; reason: string }
/** A stored organization with its own public page that can be claimed. */
export type Hit = { orgId: string; name: string; slug: string; orgTypes: string[] }
export type Suggestion = { orgId: string; name: string; slug: string; orgTypes: string[]; group: SuggestGroup; reason: string }

/**
 * Candidates in priority order against the organizations that exist (by normalized name). The first matching name wins; an organization
 * is suggested once, under the first group that names it; the organization itself and ones already linked are left out; each group is capped.
 */
export function mergeSuggestions(candidates: Candidate[], hits: Map<string, Hit>, exclude: ReadonlySet<string>): Suggestion[] {
  const seen = new Set<string>()
  const count: Record<SuggestGroup, number> = { PEERS: 0, EMPLOYERS: 0, HIGHER_ED: 0 }
  const out: Suggestion[] = []
  for (const c of candidates) {
    if (count[c.group] >= GROUP_CAP[c.group]) continue
    const hit = c.keys.map((k) => hits.get(k)).find((h): h is Hit => !!h)
    if (!hit || exclude.has(hit.orgId) || seen.has(hit.orgId)) continue
    seen.add(hit.orgId)
    count[c.group] += 1
    out.push({ ...hit, group: c.group, reason: c.reason })
  }
  return out
}

/** A college reads the groups in its own words. */
const COLLEGE_LABELS: Record<SuggestGroup, string> = { PEERS: 'Workforce and community partners', EMPLOYERS: 'Employers', HIGHER_ED: 'Other colleges and universities' }
export const byGroup = <T extends Suggestion>(list: T[], kind: 'workforce' | 'college' = 'workforce') =>
  SUGGEST_GROUPS.map((g) => ({ key: g.key, label: kind === 'college' ? COLLEGE_LABELS[g.key] : g.label, items: list.filter((s) => s.group === g.key) })).filter((g) => g.items.length > 0)

/** How many organizations to link in one go. */
export const MAX_LINK_BATCH = 40

/** The count words for the Home reminder. */
export const suggestionLine = (n: number) => `We found ${n} organization${n === 1 ? '' : 's'} you probably know: peers, employers and colleges. Pick the ones to invite; each gets a free page of its own.`

// Which stored organizations in a state read as peers of a workforce organization in a city: chambers, economic development groups,
// workforce and community partners, named for the city or doing that work. Colleges are their own group, the workforce board and job
// centers come from their own tables, and a school, congregation or seminary is not a peer.
const PEER_KEEP = /chamber|economic development|workforce|alliance|partnership|urban league|foundation|metro government|growth|council/i
const PEER_DROP = /workforce (development|innovation) board|college|university|school|seminary|theological|jewish|church|catholic|baptist|hospital|health/i
export const isLikelyPeerName = (name: string) => PEER_KEEP.test(name) && !PEER_DROP.test(name)
