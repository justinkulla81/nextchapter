'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ensureUser } from '@/lib/auth/ensure-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { allowByIp, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { firmNameOf, getFirmBriefs, recruiterFirmIdForOrg } from '@/lib/seo/search-firm-pages'
import { notifyOwnerOfFollow } from '@/lib/notify/follow-alert-server'
import { shareInterestWithFirm } from '@/lib/recruiter-interest/server'
import { disconnectIntakeConnection } from '@/lib/recruiter/intake/consent'

export type InterestSource = 'search_firm_page' | 'directory' | 'recommendation' | 'package'
export type InterestResult = { ok: true; interested: boolean; next: string | null } | { ok: false; error: string }

const SOURCES: InterestSource[] = ['search_firm_page', 'directory', 'recommendation', 'package']

/**
 * One button. The member is interested in a firm. With no résumé on file the answer sends them straight to add one (the
 * onboarding résumé step for a new visitor, the résumé page for a member). Nothing reaches the firm: the interest is
 * held until the member chooses to share it.
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
  captureServerEvent(profile.id, 'recruiter_interest_expressed', { firmOrgId: orgId, source, hasResume, interestCount: total, registered: !!profile.registrationCompletedAt })
  revalidatePath('/dashboard/recruiter-package')
  const next = hasResume ? null : profile.registrationCompletedAt ? '/dashboard/resume' : '/onboarding/resume'
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

export type FirmInterestState =
  | { signedIn: false }
  | { signedIn: true; picked: false; hasResume: boolean }
  | { signedIn: true; picked: true; status: 'HELD' | 'SHARED'; sharedAt: string | null; hasResume: boolean; joined: boolean }

/**
 * For the cached firm page: is the visitor a signed-in member, and where do they stand with this firm? Reads only, and
 * never throws (a visitor, an anonymous onboarding session or a failed read all come back as "not signed in").
 */
export async function getFirmInterestState(orgId: string): Promise<FirmInterestState> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.is_anonymous) return { signedIn: false }
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true, resumeStepComplete: true } })
    if (!profile) return { signedIn: false }
    const [interest, resumes] = await Promise.all([
      prisma.recruiterInterest.findUnique({ where: { candidateId_firmOrgId: { candidateId: profile.id, firmOrgId: orgId } }, select: { status: true, sharedAt: true } }),
      prisma.resume.count({ where: { candidateId: profile.id, looksLikeResume: { not: false } } }),
    ])
    const hasResume = profile.resumeStepComplete || resumes > 0
    if (!interest || interest.status === 'WITHDRAWN') return { signedIn: true, picked: false, hasResume }
    const joined = (await getFirmBriefs([orgId])).get(orgId)?.joined === true
    return { signedIn: true, picked: true, status: interest.status, sharedAt: interest.sharedAt?.toISOString() ?? null, hasResume, joined }
  } catch {
    return { signedIn: false }
  }
}
