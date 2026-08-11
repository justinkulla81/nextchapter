import type { ReferenceType } from '@prisma/client'

// Reference Check requires ≥1 former manager, ≥1 peer, ≥1 direct report or
// client among completed references (Assessment Layer spec §5.1). This is
// a nudge shown on the candidate's references page, not a hard gate on
// requesting a reference — candidates naturally build the mix over several
// separate invites, and blocking a single add would break that flow.
export interface RequiredMixStatus {
  hasManager: boolean
  hasPeer: boolean
  hasReportOrClient: boolean
  satisfied: boolean
}

const MANAGER_TYPES: ReferenceType[] = ['DIRECT_MANAGER', 'SKIP_LEVEL_MANAGER']
const PEER_TYPES: ReferenceType[] = ['PEER', 'FACULTY_ADVISOR']
const REPORT_OR_CLIENT_TYPES: ReferenceType[] = ['DIRECT_REPORT', 'CLIENT']

export function computeRequiredMix(completedTypes: ReferenceType[]): RequiredMixStatus {
  const hasManager = completedTypes.some((t) => MANAGER_TYPES.includes(t))
  const hasPeer = completedTypes.some((t) => PEER_TYPES.includes(t))
  const hasReportOrClient = completedTypes.some((t) => REPORT_OR_CLIENT_TYPES.includes(t))
  return {
    hasManager,
    hasPeer,
    hasReportOrClient,
    satisfied: hasManager && hasPeer && hasReportOrClient,
  }
}
