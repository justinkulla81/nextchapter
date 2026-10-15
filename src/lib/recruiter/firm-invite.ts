import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { slugify } from '@/lib/recruiter/intake/slug'
import { NON_COMPANY_DOMAINS } from '@/lib/text/email-domain'

export interface InvitedFirm {
  id: string
  name: string
}

function domainOf(email: string): string | null {
  const m = email.trim().toLowerCase().match(/@([a-z0-9.-]+)$/)
  return m ? m[1] : null
}
const rootOf = (domain: string) => domain.split('.').slice(-2).join('.')

/**
 * A setup link is made for a firm and (when the admin entered one) a contact
 * at that firm. The link is a secret, but a forwarded or leaked one must not
 * hand the firm to a stranger, so with a contact on file the claimant has to
 * be at the contact's company: the same address, or the same company domain.
 * A personal-mail contact (gmail etc.) proves nothing about the company, so
 * it needs the exact address. No contact on file means the link alone decides.
 */
export function emailMayClaimFirm(claimantEmail: string, contactEmail: string | null | undefined): boolean {
  if (!contactEmail) return true
  const claimant = claimantEmail.trim().toLowerCase()
  const contact = contactEmail.trim().toLowerCase()
  if (claimant === contact) return true
  const cd = domainOf(contact)
  const ad = domainOf(claimant)
  if (!cd || !ad) return false
  if (NON_COMPANY_DOMAINS.has(rootOf(cd))) return false
  return rootOf(cd) === rootOf(ad)
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
export async function claimFirmWithToken(
  recruiter: { id: string; fullName: string; workEmail: string; firmRole: string | null },
  token: string,
): Promise<InvitedFirm | null> {
  if (recruiter.firmRole) return null
  const firm = await findClaimableFirm(token)
  if (!firm) return null
  const target = await prisma.recruiterFirm.findUnique({ where: { id: firm.id }, select: { onboardingContactEmail: true } })
  if (!emailMayClaimFirm(recruiter.workEmail, target?.onboardingContactEmail)) {
    captureServerEvent(recruiter.id, 'talent_firm_claim_refused', { recruiterId: recruiter.id, firmId: firm.id, reason: 'email_mismatch' })
    return null
  }
  await prisma.recruiter.update({
    where: { id: recruiter.id },
    data: { recruiterFirmId: firm.id, firmRole: 'ADMIN', firmName: firm.name, intakeSlug: slugify(recruiter.fullName) || 'me' },
  })
  captureServerEvent(recruiter.id, 'talent_firm_claimed_via_link', { recruiterId: recruiter.id, firmId: firm.id })
  return firm
}
