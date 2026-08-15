import 'server-only'
import { getInsidersForCompany, type InsiderSummary } from '@/lib/companies/insider-network'

// Partners Master Build Script §A3.3 — Premium "decision-maker mapping: who
// to reach at target companies." No licensed contact-data vendor exists
// (§A3.2/§E2.2 — redistribution rights not confirmed, no vendor contract),
// so this does not attempt to name an org chart. Instead it reuses the real
// insider network's current-employee records (MemberEmployment, via
// getInsidersForCompany — the exact same privacy-respecting query the
// company page's "People who know this company" section already uses,
// including its Confidential Search Mode exclusion and the current-employer
// explicit opt-in gate) filtered to isCurrent === true: real members who
// currently work at the target company, with role level and function, never
// a name until an ask is answered — same reveal discipline as everywhere
// else the insider network appears.
export async function getDecisionMakerSignals(companyId: string, viewerCandidateId: string): Promise<InsiderSummary[]> {
  const insiders = await getInsidersForCompany(companyId, viewerCandidateId)
  return insiders.filter((i) => i.isCurrent)
}
