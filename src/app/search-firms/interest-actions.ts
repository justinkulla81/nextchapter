'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ensureUser } from '@/lib/auth/ensure-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { allowByIp, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { firmNameOf, recruiterFirmIdForOrg } from '@/lib/seo/search-firm-pages'
import { notifyOwnerOfFollow } from '@/lib/notify/follow-alert-server'
import { shareInterestWithFirm } from '@/lib/recruiter-interest/server'
import { disconnectIntakeConnection } from '@/lib/recruiter/intake/consent'

export type InterestSource = 'search_firm_page' | 'directory' | 'recommendation' | 'package'
export type InterestResult = { ok: true; interested: boolean; next: string | null } | { ok: false; error: string }

const SOURCES: InterestSource[] = ['search_firm_page', 'directory', 'recommendation', 'package']

/**
 * One button. The member is interested in a firm. A registered member goes to their recruiter package, where the next
 * steps are (add the résumé first when there is none); a new visitor with no résumé goes to the onboarding résumé step.
 * Nothing reaches the firm: the interest is held until the member chooses to share it.
 */
export async function expressInterest(orgId: string, source: InterestSource): Promise<InterestResult> {
  if (!SOURCES.includes(source)) return { ok: false, error: 'Something went wrong. Please try again.' }
  if (!(await allowByIp('express-interest', 60, HOUR_MS))) return { ok: false, error: RATE_LIMITED_MESSAGE }
  const orgName = await firmNameOf(orgId)
  if (!orgName) return { ok: false, error: 'We could not find that firm. Refresh the page and try again.' }

  let user
  try {
    user = await ensureUser(await createClient())
  } catch {
    return { ok: false, error: 'We could not start your session. Please try again.' }
  }
  const profile = await getOrCreateCandidateProfile(user.id)
  const existing = await prisma.recruiterInterest.findUnique({ where: { candidateId_firmOrgId: { candidateId: profile.id, firmOrgId: orgId } } })
  await prisma.recruiterInterest.upsert({
    where: { candidateId_firmOrgId: { candidateId: profile.id, firmOrgId: orgId } },
    create: { candidateId: profile.id, firmOrgId: orgId, source },
    update: existing?.status === 'WITHDRAWN' ? { status: 'HELD', source, sharedAt: null } : {},
  })
  // Tell the owner only when this press is new: a first interest, or one the member had withdrawn.
  if (!existing || existing.status === 'WITHDRAWN') notifyOwnerOfFollow('recruiter', profile.id, orgName, source)
  const hasResume = profile.resumeStepComplete || (await prisma.resume.count({ where: { candidateId: profile.id, looksLikeResume: { not: false } } })) > 0
  const total = await prisma.recruiterInterest.count({ where: { candidateId: profile.id, status: { not: 'WITHDRAWN' } } })
  // A registered member lands on their recruiter package: the firms they picked and the steps that make it stronger
  // (add or fix the résumé, assessment, references). A visitor still in onboarding with no résumé goes on to that step.
  const next = profile.registrationCompletedAt ? '/dashboard/recruiter-package' : hasResume ? null : '/onboarding/resume'
  captureServerEvent(profile.id, 'recruiter_interest_expressed', { firmOrgId: orgId, source, hasResume, interestCount: total, registered: !!profile.registrationCompletedAt, next })
  revalidatePath('/dashboard/recruiter-package')
  return { ok: true, interested: true, next }
}

export async function withdrawInterest(orgId: string): Promise<InterestResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to change your recruiter interests.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  const interest = await prisma.recruiterInterest.findUnique({ where: { candidateId_firmOrgId: { candidateId: profile.id, firmOrgId: orgId } } })
  if (!interest || interest.status === 'WITHDRAWN') return { ok: true, interested: false, next: null }
  if (interest.status === 'SHARED' && profile.email) {
    // They had sent the résumé: end the firm's connection too, the same way the member's own disconnect does.
    const intake = await prisma.intakeCandidate.findUnique({ where: { email: profile.email.toLowerCase() }, select: { id: true } })
    const firmId = await recruiterFirmIdForOrg(orgId)
    if (intake && firmId) {
      const conn = await prisma.intakeConnection.findUnique({ where: { firmId_intakeCandidateId: { firmId, intakeCandidateId: intake.id } } })
      if (conn && !conn.disconnectedAt) await disconnectIntakeConnection(conn.id, null)
    }
  }
  await prisma.recruiterInterest.update({ where: { id: interest.id }, data: { status: 'WITHDRAWN' } })
  captureServerEvent(profile.id, 'recruiter_interest_withdrawn', { firmOrgId: orgId, wasShared: interest.status === 'SHARED' })
  revalidatePath('/dashboard/recruiter-package')
  return { ok: true, interested: false, next: null }
}

export async function shareWithFirm(orgId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to share your résumé.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  const r = await shareInterestWithFirm(profile.id, orgId)
  revalidatePath('/dashboard/recruiter-package')
  return r
}
