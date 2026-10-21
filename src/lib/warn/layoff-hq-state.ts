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

/**
 * Where a company is headquartered, when the layoff story named no place. In
 * order: a state it has filed WARN notices in (our own data, most common
 * first), then the business address on its SEC filings (exact name match only,
 * so a similar name never lends its address). A derived state is saved on the
 * CRM organization when that has none. Returns null when neither knows;
 * never throws.
 */
export async function inferHqState(normalizedEmployer: string): Promise<string | null> {
  try {
    const filed = await prisma.warnNotice.groupBy({
      by: ['state'], where: { normalizedEmployer, source: 'WARN_FILING', state: { not: null } }, _count: { _all: true }, orderBy: { _count: { state: 'desc' } }, take: 1,
    })
    let state = usStateOrNull(filed[0]?.state)
    if (!state) {
      const cik = (await secCiks()).get(normalizedEmployer)
      if (cik) {
        const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: { 'User-Agent': SEC_USER_AGENT }, signal: AbortSignal.timeout(15_000) })
        if (res.ok) {
          const d = (await res.json()) as { addresses?: { business?: { stateOrCountry?: string } } }
          state = usStateOrNull(d.addresses?.business?.stateOrCountry)
        }
      }
    }
    if (state) {
      await prisma.crmOrganization.updateMany({ where: { canonicalNameNormalized: normalizedEmployer, usState: null }, data: { usState: state } }).catch(() => {})
    }
    return state
  } catch (e) {
    console.error('Headquarters state lookup failed for', normalizedEmployer, e)
    return null
  }
}
