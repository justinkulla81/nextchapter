import 'server-only'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { ingestIntake, processIntakeResume } from '@/lib/recruiter/intake/pipeline'
import { getFirmListings, verifiedRecruiterFirmForOrg, type CachedFirmListing } from '@/lib/seo/search-firm-pages'
import { recommend, type FirmFit, type MemberSignals } from '@/lib/recruiter-interest/fit'

// A member's interest in a search firm lives on RecruiterInterest (prisma/manual/recruiter-interest.sql), against the
// firm's CRM organization, so it exists before the firm has joined. HELD: nothing went to the firm. SHARED: the member
// chose to send their résumé once the firm was verified; that goes in through the same intake the firm's own page uses.

export type ShareResult = { ok: true } | { ok: false; error: string }

export async function memberSignals(candidateId: string): Promise<MemberSignals> {
  const p = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { highestLevelReached: true, primaryFunction: true, targetFunction: true, targetIndustries: true, currentState: true },
  })
  return {
    highestLevel: p?.highestLevelReached ?? null,
    functions: [p?.primaryFunction, p?.targetFunction],
    industries: p?.targetIndustries ?? [],
    state: p?.currentState ?? null,
  }
}

/** Firms that fit the member and that they have not already picked. Empty when the member's résumé gave us nothing to go on. */
export async function recommendedFirms(candidateId: string, take = 6): Promise<(CachedFirmListing & FirmFit)[]> {
  const [signals, mine, firms] = await Promise.all([
    memberSignals(candidateId),
    prisma.recruiterInterest.findMany({ where: { candidateId }, select: { firmOrgId: true } }),
    getFirmListings(),
  ])
  return recommend(signals, firms, new Set(mine.map((m) => m.firmOrgId)), take)
}

/** Send the member's résumé to a firm that has joined. Only ever called from the member's own click. */
export async function shareInterestWithFirm(candidateId: string, orgId: string): Promise<ShareResult> {
  const interest = await prisma.recruiterInterest.findUnique({ where: { candidateId_firmOrgId: { candidateId, firmOrgId: orgId } } })
  if (!interest || interest.status === 'WITHDRAWN') return { ok: false, error: 'Express interest in this firm first.' }
  if (interest.status === 'SHARED') return { ok: true }
  const firm = await verifiedRecruiterFirmForOrg(orgId)
  if (!firm) return { ok: false, error: 'This firm has not joined NextChapter yet, so there is nothing to share with.' }

  const [profile, resume] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { firstName: true, lastName: true, email: true, linkedInUrl: true } }),
    prisma.resume.findFirst({ where: { candidateId, looksLikeResume: { not: false } }, orderBy: { uploadedAt: 'desc' }, select: { filePath: true, fileName: true } }),
  ])
  if (!resume) return { ok: false, error: 'Add your résumé first. It is what the firm receives.' }
  const download = await createAdminClient().storage.from('resumes').download(resume.filePath)
  if (download.error || !download.data) return { ok: false, error: 'We could not read your résumé file. Please upload it again.' }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || null
  const result = await ingestIntake({
    firm,
    recruiter: null,
    source: 'MEMBER_INTEREST',
    entryPoint: 'FIRM_PAGE',
    person: { fullName, email: profile?.email ?? null, linkedinUrl: profile?.linkedInUrl ?? null },
    file: { buffer: Buffer.from(await download.data.arrayBuffer()), fileName: resume.fileName, contentType: download.data.type || null },
    consentScopes: [],
    ip: null,
  })
  if (!result.ok) return { ok: false, error: result.message }

  await prisma.recruiterInterest.update({ where: { id: interest.id }, data: { status: 'SHARED', sharedAt: new Date() } })
  after(async () => {
    try {
      await processIntakeResume(result.resumeId)
    } catch (error) {
      console.error('Member interest intake processing failed:', error)
    }
  })
  captureServerEvent(candidateId, 'recruiter_interest_shared', { firmOrgId: orgId, firmId: firm.id, connectionId: result.connectionId })
  return { ok: true }
}
