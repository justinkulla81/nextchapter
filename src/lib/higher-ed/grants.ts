// Grants and RFPs a college can apply for, matched to what it wants to fund:
// retraining, entrepreneurship and research. Source: Grants.gov's public
// search API (federal opportunities, posted or forecast, that colleges and
// universities are eligible for: eligibility codes 06 state and 20 private
// institutions of higher education). No key; nothing about the college is
// sent. State and foundation funding are not in this source.
//
// Each purpose is a few searches (Grants.gov funding categories and
// keywords). Results are merged, tagged with every purpose that found them,
// and cached 12 hours per server instance. No database reads.

import 'server-only'
import { memoTtl } from '@/lib/db/heavy'

export type GrantPurpose = 'retraining' | 'entrepreneurship' | 'research'
export const GRANT_PURPOSES: { key: GrantPurpose; label: string; blurb: string }[] = [
  { key: 'retraining', label: 'Retraining', blurb: 'Workforce training, apprenticeships, career pathways and dislocated workers.' },
  { key: 'entrepreneurship', label: 'Entrepreneurship', blurb: 'Founders, small business, commercialization and innovation ecosystems.' },
  { key: 'research', label: 'Research', blurb: 'The future of work, learning and AI, and workforce research.' },
]

type Query = { keyword?: string; fundingCategories?: string }
// Grants.gov funding categories: ELT employment, labor and training; BC business and commerce; ED education; ST science and technology.
export const PURPOSE_QUERIES: Record<GrantPurpose, Query[]> = {
  retraining: [{ fundingCategories: 'ELT' }, { keyword: 'workforce training' }, { keyword: 'apprenticeship' }, { keyword: 'career pathways' }],
  entrepreneurship: [{ fundingCategories: 'BC' }, { keyword: 'entrepreneurship' }, { keyword: 'commercialization' }, { keyword: 'innovation ecosystem' }],
  research: [{ keyword: 'future of work' }, { keyword: 'workforce research' }, { keyword: 'artificial intelligence education' }, { keyword: 'learning sciences' }],
}

export type Grant = {
  id: string
  number: string
  title: string
  agency: string
  openDate: string | null // ISO date
  closeDate: string | null // ISO date; null = no date given (often a forecast)
  status: 'posted' | 'forecasted'
  purposes: GrantPurpose[]
  url: string
}

type Hit = { id: string; number: string; title: string; agency: string; agencyCode: string; openDate: string; closeDate: string; oppStatus: string }

const ENTITIES: Record<string, string> = { amp: '&', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', quot: '"', apos: '’', nbsp: ' ' }

/** Grants.gov titles carry HTML entities ("Veterans&rsquo;"). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[  ]/g, ' ')
}

/** "04/30/2027" -> "2027-04-30"; "" -> null. */
export function usDateToIso(d: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d.trim())
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null
}

// A search finds a notice by its full text, so a hit must also name its purpose in the title to count.
export const TITLE_MATCH: Record<GrantPurpose, RegExp> = {
  retraining: /workforce|training|apprentice|career|re-?employ|dislocated|employment|upskill|reskill|\bjobs?\b/i,
  entrepreneurship: /entrepreneur|small business|start-?ups?\b|commerciali[sz]|innovation|accelerator|incubat|venture|technology transfer/i,
  research: /future of work|workforce|labor market|learning|education|artificial intelligence|\bAI\b|skills/i,
}
// Research-training awards for scientists (NIH NRSA, T-series) are not retraining for working adults.
const NOT_RETRAINING = /research training|research service award|NRSA|Kirschstein|\(T\d{2}\)/i

// Notices from a U.S. embassy or mission abroad are for local partners there, not a U.S. college's programs.
const ABROAD = /\b(U\.S\. Mission|Embassy|Consulate)\b/i

/** Merges search hits into grants, tagging each with the purposes that found it; drops closed and overseas notices. Exported for tests. */
export function mergeHits(byPurpose: { purpose: GrantPurpose; hits: Hit[] }[], today: string): Grant[] {
  const out = new Map<string, Grant>()
  for (const { purpose, hits } of byPurpose) {
    for (const h of hits) {
      if (ABROAD.test(h.agency)) continue
      const title = decodeEntities(h.title)
      if (!TITLE_MATCH[purpose].test(title)) continue
      if (purpose === 'retraining' && NOT_RETRAINING.test(title)) continue
      const closeDate = usDateToIso(h.closeDate)
      if (closeDate && closeDate < today) continue
      const cur = out.get(h.id)
      if (cur) {
        if (!cur.purposes.includes(purpose)) cur.purposes.push(purpose)
        continue
      }
      out.set(h.id, {
        id: h.id,
        number: h.number.trim(),
        title,
        agency: decodeEntities(h.agency).trim(),
        openDate: usDateToIso(h.openDate),
        closeDate,
        status: h.oppStatus === 'forecasted' ? 'forecasted' : 'posted',
        purposes: [purpose],
        url: `https://www.grants.gov/search-results-detail/${encodeURIComponent(h.id)}`,
      })
    }
  }
  // Open with a deadline first (soonest first), then open with no deadline, then forecasts.
  const rank = (g: Grant) => (g.status === 'forecasted' ? 2 : g.closeDate ? 0 : 1)
  return [...out.values()].sort((a, b) => rank(a) - rank(b) || (a.closeDate ?? '').localeCompare(b.closeDate ?? '') || a.title.localeCompare(b.title))
}

async function search(q: Query): Promise<Hit[]> {
  const res = await fetch('https://api.grants.gov/v1/api/search2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...q, oppStatuses: 'forecasted|posted', eligibilities: '06|20', rows: 50 }),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Grants.gov answered ${res.status}`)
  const body = (await res.json()) as { errorcode?: number; data?: { oppHits?: Hit[] } }
  if (body.errorcode) throw new Error(`Grants.gov error ${body.errorcode}`)
  return body.data?.oppHits ?? []
}

async function loadAll(): Promise<{ grants: Grant[]; checkedAt: string; failed: number }> {
  let failed = 0
  const byPurpose = await Promise.all(
    GRANT_PURPOSES.flatMap(({ key }) =>
      PURPOSE_QUERIES[key].map(async (q) => {
        try {
          return { purpose: key, hits: await search(q) }
        } catch (err) {
          failed++
          console.error('[grants] search failed', q, err)
          return { purpose: key, hits: [] as Hit[] }
        }
      }),
    ),
  )
  const total = Object.values(PURPOSE_QUERIES).flat().length
  // Every search failing is an outage: throw, so the cache keeps nothing and the screen says so.
  if (failed === total) throw new Error('Grants.gov is not answering')
  const now = new Date()
  return { grants: mergeHits(byPurpose, now.toISOString().slice(0, 10)), checkedAt: now.toISOString(), failed }
}

const cached = memoTtl(12 * 60 * 60_000, () => 'all', loadAll)

/** Every current federal opportunity for the three purposes, cached 12 hours. */
export function federalGrants(): Promise<{ grants: Grant[]; checkedAt: string; failed: number }> {
  return cached()
}

// A college's choices, in Institution.enabledFeatures.grants.
export type GrantSettings = { saved: string[]; dismissed: string[] }

export function grantSettingsFrom(enabledFeatures: unknown): GrantSettings {
  const g = (enabledFeatures as { grants?: Partial<GrantSettings> } | null)?.grants ?? {}
  const ids = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string').slice(0, 500) : [])
  return { saved: ids(g.saved), dismissed: ids(g.dismissed) }
}
