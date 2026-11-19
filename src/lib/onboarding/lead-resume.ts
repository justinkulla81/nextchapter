import 'server-only'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { runResumeParse } from '@/lib/resume/background-parse'
import { claimParse, readParseState } from '@/lib/resume/parse-state'
import { PARSE_STALE_MS, type ResumeParseState } from '@/lib/resume/parse-view'

const LEAD_RESUME_DAYS = 30

/** The résumé this person already sent from a public page (the match box), when it is recent: offered on the résumé step. */
export async function leadResumeFor(email: string | null | undefined): Promise<{ id: string; fileName: string } | null> {
  if (!email) return null
  const lead = await prisma.resumeSubmissionLead.findFirst({
    where: { email: email.trim().toLowerCase(), filePath: { not: null }, createdAt: { gte: new Date(Date.now() - LEAD_RESUME_DAYS * 86_400_000) } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileName: true },
  })
  return lead ? { id: lead.id, fileName: lead.fileName || 'your résumé' } : null
}

/**
 * Starts reading the résumé this person sent from a public page as their own: the file is copied from leads/ into the member's
 * folder and read exactly as an onboarding upload is (runResumeParse). 'running' when a reading is already under way.
 */
export async function startLeadResumeParse(
  profile: { id: string; journeyDetails: unknown },
  email: string | null | undefined,
): Promise<'started' | 'running' | 'not_found' | 'copy_failed'> {
  const found = await leadResumeFor(email)
  if (!found) return 'not_found'
  const lead = await prisma.resumeSubmissionLead.findUnique({ where: { id: found.id }, select: { filePath: true, fileName: true } })
  if (!lead?.filePath) return 'not_found'

  const current = readParseState(profile.journeyDetails)
  if (current?.status === 'processing' && Date.now() - new Date(current.startedAt).getTime() < PARSE_STALE_MS) return 'running'
  const ext = lead.filePath.endsWith('.pdf') ? 'pdf' : 'docx'
  const path = `${profile.id}/${crypto.randomUUID()}.${ext}`
  const admin = createAdminClient()
  const { error: copyError } = await admin.storage.from('resumes').copy(lead.filePath, path)
  if (copyError) return 'copy_failed'

  const state: ResumeParseState = {
    attempt: crypto.randomUUID(),
    status: 'processing',
    startedAt: new Date().toISOString(),
    path,
    fileName: lead.fileName || `resume.${ext}`,
    fileType: ext,
    includeInResumeBook: false,
  }
  if (!(await claimParse(profile.id, state))) {
    await admin.storage.from('resumes').remove([path])
    return 'running'
  }
  await prisma.resumeSubmissionLead.update({ where: { id: found.id }, data: { candidateId: profile.id } }).catch(() => {})
  captureServerEvent(profile.id, 'lead_resume_reused', { fileType: ext })
  after(() => runResumeParse(profile.id, state.attempt))
  return 'started'
}

/** The member opened their account from the résumé they sent (one-click membership, owner decision 2026-11-19). */
export function joinedWithResume(journeyDetails: unknown): boolean {
  return typeof (journeyDetails as Record<string, unknown> | null)?.joinedWithResumeAt === 'string'
}

/** Marks the profile as joined with a sent résumé: it registers once the résumé is read, with the questions left for later. */
export async function markJoinedWithResume(profileId: string): Promise<void> {
  const at = JSON.stringify(new Date().toISOString())
  await prisma.$executeRaw`
    UPDATE "CandidateProfile"
    SET "journeyDetails" = jsonb_set(COALESCE("journeyDetails", '{}'::jsonb), '{joinedWithResumeAt}', ${at}::jsonb),
        "assessmentComplete" = true
    WHERE "id" = ${profileId}`
}
