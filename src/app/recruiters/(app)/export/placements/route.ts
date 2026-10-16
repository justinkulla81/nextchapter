import { prisma } from '@/lib/prisma'
import { getCurrentRecruiter } from '@/lib/recruiter/current-recruiter'
import { csvResponse, datedName } from '@/lib/partners/csv-response'
import { recordPartnerAudit } from '@/lib/partners/audit'

// Submissions and placements. A firm administrator gets the whole firm; everyone
// else gets their own. A candidate's name is included only where that person has
// consented to an introduction to this recruiter.
export async function GET() {
  const recruiter = await getCurrentRecruiter()
  const firmWide = recruiter.firmRole === 'ADMIN' && recruiter.recruiterFirmId
  const recruiterIds = firmWide
    ? (await prisma.recruiter.findMany({ where: { recruiterFirmId: recruiter.recruiterFirmId }, select: { id: true } })).map((r) => r.id)
    : [recruiter.id]
  const subs = await prisma.recruiterCandidateSubmission.findMany({
    where: { recruiterId: { in: recruiterIds } },
    orderBy: { stageUpdatedAt: 'desc' },
    take: 2000,
    select: {
      recruiterId: true,
      candidateId: true,
      roleTitle: true,
      companyName: true,
      stage: true,
      stageUpdatedAt: true,
      candidate: { select: { firstName: true, lastName: true } },
      placement: { select: { placedAt: true, startDate: true, feeType: true, feePercentage: true, feeFlatAmountUsd: true } },
    },
  })
  const consents = await prisma.recruiterCandidateIntroduction.findMany({
    where: { recruiterId: { in: recruiterIds }, status: 'CONSENTED', candidateId: { in: subs.map((s) => s.candidateId) } },
    select: { recruiterId: true, candidateId: true },
  })
  const consented = new Set(consents.map((c) => `${c.recruiterId}:${c.candidateId}`))
  await recordPartnerAudit({
    portal: 'RECRUITER',
    refId: recruiter.recruiterFirmId ?? recruiter.id,
    actorUserId: recruiter.userId,
    actorLabel: recruiter.workEmail,
    action: 'export.placements',
    detail: { rows: subs.length, firmWide: Boolean(firmWide) },
  })
  return csvResponse(
    datedName('placements'),
    subs.map((s) => ({
      candidate: consented.has(`${s.recruiterId}:${s.candidateId}`) ? `${s.candidate.firstName ?? ''} ${s.candidate.lastName ?? ''}`.trim() : 'Name not shared',
      role: s.roleTitle,
      company: s.companyName,
      stage: s.stage.toLowerCase(),
      updated: s.stageUpdatedAt,
      placed: s.placement?.placedAt ?? null,
      start_date: s.placement?.startDate ?? null,
      fee_type: s.placement?.feeType ?? null,
      fee_percent: s.placement?.feePercentage ?? null,
      fee_flat_usd: s.placement?.feeFlatAmountUsd ?? null,
    })),
    'No submissions yet.',
  )
}
