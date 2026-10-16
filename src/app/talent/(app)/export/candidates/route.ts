import { prisma } from '@/lib/prisma'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { candidateDisplayName } from '@/lib/talent/candidate-identity'
import { csvResponse, datedName } from '@/lib/partners/csv-response'
import { recordPartnerAudit } from '@/lib/partners/audit'

// The hiring team's candidate pipeline. Candidates are listed the way a teaser is, by
// level and function, so nothing leaves the portal that a candidate has not chosen
// to show; names appear in the portal itself where the candidate allows them.
export async function GET() {
  const employer = await getTalentDashboardData()
  const interactions = await prisma.candidateInteraction.findMany({
    where: { employerId: employer.id },
    orderBy: { updatedAt: 'desc' },
    take: 2000,
    select: {
      status: true,
      updatedAt: true,
      role: { select: { roleTitle: true } },
      candidate: { select: { privacyTier: true, firstName: true, lastName: true, highestLevelReached: true, primaryFunction: true, currentCity: true } },
    },
  })
  await recordPartnerAudit({ portal: 'HIRING', refId: employer.id, actorUserId: employer.userId, actorLabel: employer.contactName, action: 'export.candidates', detail: { rows: interactions.length } })
  return csvResponse(
    datedName('candidates'),
    interactions.map((i) => ({
      candidate: candidateDisplayName(i.candidate, true),
      city: i.candidate.currentCity,
      role: i.role?.roleTitle ?? null,
      stage: i.status.toLowerCase().replace(/_/g, ' '),
      updated: i.updatedAt,
    })),
    'No candidates in your pipeline yet.',
  )
}
