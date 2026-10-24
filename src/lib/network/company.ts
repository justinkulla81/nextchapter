import 'server-only'
import { searchPublicBoard, type PublicBoardResult } from '@/lib/jobs/public-board'
import { getCompanies, type CompanySummary } from '@/lib/warn/layoff-pages'
import { NETWORK_MIN_STATE_JOBS, isNetworkCompany, primaryState } from './eligibility'

export interface NetworkCompany {
  company: CompanySummary
  /** The state with the most named workers. */
  state: string
  /** Open professional jobs at the employer itself (may be none). */
  atEmployer: PublicBoardResult
  /** Open professional jobs in the primary state. */
  inState: PublicBoardResult
}

/**
 * Everything a /network/company page shows, or null when the employer has no page: no notice in the last
 * two years, fewer than the minimum workers, or too few open jobs in its state to say anything useful.
 */
export async function getNetworkCompany(slug: string): Promise<NetworkCompany | null> {
  const company = (await getCompanies()).get(slug)
  if (!company || !isNetworkCompany(company)) return null
  const state = primaryState(company.notices)
  // location is free text ("Louisville, KY"), so the state is matched on ", KY".
  const [atEmployer, inState] = await Promise.all([
    searchPublicBoard({ q: company.name, loc: '', remote: false }),
    searchPublicBoard({ q: '', loc: `, ${state}`, remote: false }),
  ])
  if (inState.total < NETWORK_MIN_STATE_JOBS) return null
  return { company, state, atEmployer, inState }
}
