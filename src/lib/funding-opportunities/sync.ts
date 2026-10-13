import 'server-only'
import { importP0Leads } from '@/lib/crm/p0-leads'
import { GRANT_KEYWORDS, SAM_NAICS, isLive, isRelevant, toLead, type FundingNotice } from './relevance'
import { noticesFromHits, searchGrantsGov } from './grants-gov'
import { noticesFromSam, searchSam } from './sam-gov'

const LOOKBACK_DAYS = 30
const MAX_NEW_PER_RUN = 25
const PAUSE_MS = 400

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface FundingSyncResult {
  grants: { searched: number; failed: string[]; candidates: number }
  sam: { searched: number; failed: string[]; candidates: number; skipped: string | null }
  relevant: number
  filed: number
  alreadyLogged: number
  capped: boolean
  filedTitles: string[]
}

/**
 * Daily: finds open federal grants (Grants.gov) and solicitations / RFIs
 * (SAM.gov) in our subject area and files each as a CRM note on the issuing
 * agency, with a deadline where it has one. No LLM call, no metered cost.
 *
 * Re-running is harmless: the CRM import keys each lead on (link, org, person)
 * and a repeat comes back as already logged. The 30-day lookback therefore
 * doubles as outage recovery.
 */
export async function syncFundingOpportunities(opts: { dryRun?: boolean; now?: Date } = {}): Promise<FundingSyncResult> {
  const now = opts.now ?? new Date()
  const result: FundingSyncResult = {
    grants: { searched: 0, failed: [], candidates: 0 },
    sam: { searched: 0, failed: [], candidates: 0, skipped: null },
    relevant: 0, filed: 0, alreadyLogged: 0, capped: false, filedTitles: [],
  }

  // ── Grants.gov ──
  const hits: Record<string, Awaited<ReturnType<typeof searchGrantsGov>>> = {}
  for (const keyword of GRANT_KEYWORDS) {
    try {
      hits[keyword] = await searchGrantsGov(keyword)
      result.grants.searched++
    } catch (e) {
      console.error('Grants.gov search failed', keyword, e)
      result.grants.failed.push(keyword)
    }
    await sleep(PAUSE_MS)
  }
  const grants = noticesFromHits(hits)
  result.grants.candidates = grants.length

  // ── SAM.gov ──
  let sam: FundingNotice[] = []
  const key = process.env.SAM_API_KEY
  if (!key) {
    result.sam.skipped = 'SAM_API_KEY not set'
  } else {
    const budget = Math.max(0, Number(process.env.SAM_DAILY_REQUESTS ?? 4))
    const from = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000)
    const byNaics: Record<string, Awaited<ReturnType<typeof searchSam>>> = {}
    for (const ncode of SAM_NAICS.slice(0, budget)) {
      try {
        byNaics[ncode] = await searchSam(key, ncode, from, now)
        result.sam.searched++
      } catch (e) {
        console.error('SAM.gov search failed', ncode, e instanceof Error ? e.message : e)
        result.sam.failed.push(ncode)
      }
      await sleep(PAUSE_MS)
    }
    sam = noticesFromSam(byNaics)
    result.sam.candidates = sam.length
  }

  const relevant = [...grants.filter(isRelevant), ...sam]
    .filter((n) => isLive(n, now, LOOKBACK_DAYS))
  result.relevant = relevant.length

  const leads = relevant.slice(0, MAX_NEW_PER_RUN * 4).map((n) => ({ n, lead: toLead(n, now) }))
  const imported = await importP0Leads(leads.map((l) => l.lead), opts.dryRun ?? false)

  let filed = 0
  imported.forEach((r, i) => {
    if (r.alreadyLogged) result.alreadyLogged++
    else if (filed < MAX_NEW_PER_RUN) { filed++; result.filedTitles.push(leads[i].n.title) }
  })
  result.filed = filed
  result.capped = imported.length - result.alreadyLogged > MAX_NEW_PER_RUN
  return result
}
