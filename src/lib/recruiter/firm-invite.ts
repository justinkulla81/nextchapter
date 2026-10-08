import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { slugify } from '@/lib/recruiter/intake/slug'

export interface InvitedFirm {
  id: string
  name: string
}

/** The firm a registration link points at, only while it is still unclaimed. */
export async function findClaimableFirm(token: string | null | undefined): Promise<InvitedFirm | null> {
  if (!token) return null
  const firm = await prisma.recruiterFirm.findUnique({
    where: { onboardingToken: token },
    select: { id: true, name: true, _count: { select: { recruiters: true } } },
  })
  if (!firm || firm._count.recruiters > 0) return null
  return { id: firm.id, name: firm.name }
}

/**
 * Makes this recruiter the admin of the firm the link was made for. Only
 * works while the firm has no members and the recruiter is not already on a
 * firm's team. The token stays until setup is finished so the person can
 * come back to the link.
 */
export async function claimFirmWithToken(recruiter: { id: string; fullName: string; firmRole: string | null }, token: string): Promise<InvitedFirm | null> {
  if (recruiter.firmRole) return null
  const firm = await findClaimableFirm(token)
  if (!firm) return null
  await prisma.recruiter.update({
    where: { id: recruiter.id },
    data: { recruiterFirmId: firm.id, firmRole: 'ADMIN', firmName: firm.name, intakeSlug: slugify(recruiter.fullName) || 'me' },
  })
  captureServerEvent(recruiter.id, 'talent_firm_claimed_via_link', { recruiterId: recruiter.id, firmId: firm.id })
  return firm
}
