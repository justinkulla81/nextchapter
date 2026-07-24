import 'server-only'
import { getCoachClientSummaries, type ClientSummary } from './client-summary'
import { detectAvoidancePattern } from './pre-session-brief'

export interface CaseloadEntry extends ClientSummary {
  isStalled: boolean
}

// Roster-level rollup — reuses getCoachClientSummaries (already zero extra
// queries) and loops detectAvoidancePattern per client. N+1 on the
// avoidance check, but fine at the caseload sizes this product actually
// has right now (a handful of coaches, each with a handful of clients) —
// same "don't over-engineer for volume you don't have" call made
// throughout this batch.
export async function getCoachCaseload(coachId: string): Promise<CaseloadEntry[]> {
  const clients = await getCoachClientSummaries(coachId)
  return Promise.all(
    clients.map(async (client) => ({
      ...client,
      isStalled: (await detectAvoidancePattern(client.id)) !== null,
    }))
  )
}
