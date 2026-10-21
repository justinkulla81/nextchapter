import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { SEC_USER_AGENT } from './sec-8k'

const US_STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '))

/** A two-letter US state code from SEC's business-address field, or null for a foreign code or anything else. */
export function usStateOrNull(code: string | null | undefined): string | null {
  const c = (code ?? '').trim().toUpperCase()
  return US_STATES.has(c) ? c : null
}

let tickers: Map<string, string> | null = null

/** SEC's company list as normalized name -> zero-padded CIK, loaded once per process. */
async function secCiks(): Promise<Map<string, string>> {
  if (tickers) return tickers
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': SEC_USER_AGENT }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`SEC company list ${res.status}`)
  const data = (await res.json()) as Record<string, { cik_str: number; title: string }>
  const m = new Map<string, string>()
  for (const row of Object.values(data)) {
    const key = normalizeOrgName(row.title)
    if (key && !m.has(key)) m.set(key, String(row.cik_str).padStart(10, '0'))
  }
  tickers = m
  return m
}

export interface Hq {
  state: string | null
  city: string | null
  /** SEC's industry description for the company ("RETAIL-GROCERY STORES"), when it has one. */
  sicDescription: string | null
  source: 'sec' | 'warn-history'
}

/**
 * Where a company is headquartered and what the SEC calls its industry, for a
 * layoff story that named no place. The business address on its SEC filings
 * (exact name match only, so a similar name never lends its address) gives the
 * state, city and industry; failing that, the state it has most often filed WARN
 * notices in (our own data). A derived state is saved on the CRM organization
 * when that has none. Returns null when neither knows; never throws.
 */
export async function inferHq(normalizedEmployer: string): Promise<Hq | null> {
  try {
    let hq: Hq | null = null
    const cik = (await secCiks()).get(normalizedEmployer)
    if (cik) {
      const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: { 'User-Agent': SEC_USER_AGENT }, signal: AbortSignal.timeout(15_000) })
      if (res.ok) {
        const d = (await res.json()) as { sicDescription?: string; addresses?: { business?: { stateOrCountry?: string; city?: string } } }
        const state = usStateOrNull(d.addresses?.business?.stateOrCountry)
        if (state || d.sicDescription) hq = { state, city: titleCase(d.addresses?.business?.city), sicDescription: d.sicDescription || null, source: 'sec' }
      }
    }
    if (!hq?.state) {
      const filed = await prisma.warnNotice.groupBy({
        by: ['state'], where: { normalizedEmployer, source: 'WARN_FILING', state: { not: null } }, _count: { _all: true }, orderBy: { _count: { state: 'desc' } }, take: 1,
      })
      const state = usStateOrNull(filed[0]?.state)
      if (state) hq = { state, city: null, sicDescription: hq?.sicDescription ?? null, source: 'warn-history' }
    }
    if (hq?.state) {
      await prisma.crmOrganization.updateMany({ where: { canonicalNameNormalized: normalizedEmployer, usState: null }, data: { usState: hq.state } }).catch(() => {})
    }
    return hq
  } catch (e) {
    console.error('Headquarters lookup failed for', normalizedEmployer, e)
    return null
  }
}

const titleCase = (s: string | null | undefined): string | null =>
  s ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).trim() || null : null
