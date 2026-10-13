import { parseUsDate, type FundingNotice } from './relevance'

// Grants.gov search2: public, no key. One request per keyword, sequential and
// paced, with every keyword that returned a notice recorded on it.
const API = 'https://api.grants.gov/v1/api/search2'

interface Hit {
  id?: string
  number?: string
  title?: string
  agency?: string
  agencyCode?: string
  openDate?: string
  closeDate?: string
  oppStatus?: string
}

export async function searchGrantsGov(keyword: string, rows = 50): Promise<Hit[]> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, oppStatuses: 'forecasted|posted', rows, sortBy: 'openDate|desc' }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Grants.gov ${res.status}`)
  const json = (await res.json()) as { errorcode?: number; msg?: string; data?: { oppHits?: Hit[] } }
  if (json.errorcode && json.errorcode !== 0) throw new Error(`Grants.gov: ${json.msg ?? json.errorcode}`)
  return json.data?.oppHits ?? []
}

/** Merge per-keyword hits into one notice each. */
export function noticesFromHits(byKeyword: Record<string, Hit[]>): FundingNotice[] {
  const byId = new Map<string, FundingNotice>()
  for (const [keyword, hits] of Object.entries(byKeyword)) {
    for (const h of hits) {
      if (!h.id || !h.title || !h.agency) continue
      const existing = byId.get(h.id)
      if (existing) {
        if (!existing.matched.includes(keyword)) existing.matched.push(keyword)
        continue
      }
      byId.set(h.id, {
        source: 'grants.gov',
        id: h.number || h.id,
        title: h.title.trim(),
        kind: h.oppStatus === 'forecasted' ? 'FORECAST' : 'GRANT',
        agency: h.agency.trim(),
        agencyType: 'FUNDER_GRANT',
        postedAt: parseUsDate(h.openDate),
        closesAt: parseUsDate(h.closeDate),
        url: `https://www.grants.gov/search-results-detail/${h.id}`,
        state: null,
        city: null,
        matched: [keyword],
        agencyCode: h.agencyCode,
        contact: null,
      })
    }
  }
  return [...byId.values()]
}
