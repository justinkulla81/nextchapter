// The board's "Great pay" / "Great benefits" filters, and the employer signals
// job cards show with them. Pure, no I/O — the id and company sets come from
// great-employers-data.ts; the card-side choice of badge is in
// great-employer-display.ts.
//
// Great pay: the employer's posted pay runs above market (CompanyHiringProfile
// payLevel 'high', 3+ jobs with pay), or this job's own posted pay is above the
// market for the role (payVsMarket), or the employer is on the curated list for
// pay (top-employers.ts).
// Great benefits: this job's structured benefits are strong (benefits.ts), or
// the employer is on the curated list for benefits.

import { normalizeOrgName } from '@/lib/text/org-name-match'
import {
  findTopEmployer,
  isKnownForBenefits,
  isKnownForPay,
  knownForLabel,
  topEmployerSourceLine,
} from '@/lib/companies/top-employers'
import type { EmployerSignals, GreatFilter } from '@/lib/jobs/great-employer-display'

export type { EmployerSignals, GreatFilter }
export { GREAT_FILTERS, GREAT_FILTER_LABEL, greatParam, parseGreatParam } from '@/lib/jobs/great-employer-display'

export interface GreatSets {
  /** Normalized names (normalizeOrgName) of companies whose posted pay runs above market. */
  payHighCompanies: ReadonlySet<string>
  /** Live jobs whose own posted pay is above market. */
  aboveMarketJobIds: ReadonlySet<string>
  /** Live jobs with strong structured benefits. */
  strongBenefitsJobIds: ReadonlySet<string>
}

interface CompanyFacts {
  payHigh: boolean
  curatedPay: boolean
  curatedBenefits: boolean
}

function companyFactsFn(sets: Pick<GreatSets, 'payHighCompanies'>) {
  // ~17k distinct company names on the board; each is looked up once.
  const memo = new Map<string, CompanyFacts>()
  return (companyName: string | null): CompanyFacts => {
    const name = companyName ?? ''
    let f = memo.get(name)
    if (!f) {
      const top = findTopEmployer(name)
      f = {
        payHigh: !!name && sets.payHighCompanies.has(normalizeOrgName(name)),
        curatedPay: isKnownForPay(top),
        curatedBenefits: isKnownForBenefits(top),
      }
      memo.set(name, f)
    }
    return f
  }
}

/**
 * Keeps a job when it passes every selected filter (both on = both must hold);
 * null when no filter is selected.
 */
export function greatFilterPredicate(
  filters: readonly GreatFilter[],
  sets: GreatSets
): ((job: { id: string; companyName: string | null }) => boolean) | null {
  if (filters.length === 0) return null
  const pay = filters.includes('pay')
  const benefits = filters.includes('benefits')
  const facts = companyFactsFn(sets)
  return (job) => {
    const f = facts(job.companyName)
    if (pay && !(f.payHigh || f.curatedPay || sets.aboveMarketJobIds.has(job.id))) return false
    if (benefits && !(f.curatedBenefits || sets.strongBenefitsJobIds.has(job.id))) return false
    return true
  }
}

export function employerSignalsFor(companyName: string | null, payHighCompanies: ReadonlySet<string>): EmployerSignals {
  const top = findTopEmployer(companyName)
  return {
    payHigh: !!companyName && payHighCompanies.has(normalizeOrgName(companyName)),
    topEmployer: top
      ? { pay: isKnownForPay(top), benefits: isKnownForBenefits(top), knownFor: knownForLabel(top), sources: topEmployerSourceLine(top) }
      : null,
  }
}
