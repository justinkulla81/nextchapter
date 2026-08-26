import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

// Single write path for the Board Advisory Work willingness question,
// called from both entry points — the Search Strategy wizard step and the
// re-ask prompt at the top of Interim Work. A "yes" from either one sets
// the same CandidateProfile.boardAdvisoryWillingness field, since it's one
// underlying fact with two chances to answer it.
export async function setBoardAdvisoryWillingness(candidateId: string, value: boolean): Promise<void> {
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { boardAdvisoryWillingness: value },
  })
  captureServerEvent(candidateId, 'board_advisory_willingness_set', { value })
}
