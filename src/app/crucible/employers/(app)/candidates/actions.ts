'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { getCrucibleEmployerDashboardData } from '@/lib/crucible/employers/get-employer-dashboard-data'

const RESUME_VIEW_WINDOW_HOURS = 24
const RESUME_VIEW_DAILY_CAP = 100

export async function getCrucibleCandidateResumeSignedUrl(
  sessionId: string,
  contestId?: string
): Promise<{ url: string } | { error: string }> {
  const employer = await getCrucibleEmployerDashboardData()

  const session = await prisma.crucibleSession.findUnique({
    where: { id: sessionId },
    select: { resumeFilePath: true, branch: true, resumeShareConsent: true },
  })
  if (!session?.resumeFilePath || session.branch !== 'PASS' || !session.resumeShareConsent) {
    return { error: 'This candidate is no longer available.' }
  }

  const windowStart = new Date(Date.now() - RESUME_VIEW_WINDOW_HOURS * 60 * 60 * 1000)
  const alreadyViewed = await prisma.crucibleEmployerResumeView.findUnique({
    where: { employerId_sessionId: { employerId: employer.id, sessionId } },
  })

  if (!alreadyViewed) {
    const recentViewCount = await prisma.crucibleEmployerResumeView.count({
      where: { employerId: employer.id, viewedAt: { gte: windowStart } },
    })
    if (recentViewCount >= RESUME_VIEW_DAILY_CAP) {
      return { error: `Daily resume-view limit reached (${RESUME_VIEW_DAILY_CAP}/day). Try again tomorrow.` }
    }

    try {
      await prisma.crucibleEmployerResumeView.create({
        data: { employerId: employer.id, sessionId, contestId },
      })
    } catch (error) {
      // P2002 — a concurrent request already recorded this view; not a real
      // failure, just don't double-count it.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
    }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('crucible-resumes').createSignedUrl(session.resumeFilePath, 60 * 10)
  if (error || !data) return { error: "Couldn't generate a download link — please try again." }

  captureServerEvent(employer.userId, 'crucible_employer_viewed_resume', { sessionId, contestId })
  return { url: data.signedUrl }
}
