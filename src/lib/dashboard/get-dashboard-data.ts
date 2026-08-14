import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { syncRegistrationCompletion } from '@/lib/onboarding/sync-registration'
import { generateMarketRealityReport } from '@/lib/reports/market-reality-report'
import { claimReportGeneration } from '@/lib/reports/report-generation-lock'
import { sendMarketRealityReportEmail } from '@/lib/email/send-market-reality-report'
import { redirectIfNotCandidate } from '@/lib/auth/redirect-non-candidate'
import { recordCandidateLoginIfDue } from '@/lib/auth/record-login'
import { getClientIp } from '@/lib/http/client-ip'

// Wrapped in React's cache() — this does a Supabase auth call plus a
// 13-relation Prisma query, and every dashboard page.tsx calls this AGAIN
// after dashboard/layout.tsx already called it once for the same request
// (nav badges, IdentifyUser). Without cache(), that's the same expensive
// fetch running twice on every single page load — cache() dedupes repeat
// calls within one request to a single execution, so the second call is
// free. Request-scoped only: a fresh navigation gets a fresh (uncached) run.
export const getDashboardData = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // An admin, hiring manager, recruiter, or coach landing here by mistake
  // (stale link, back button, password-reset fallback redirect) should
  // never silently get a stray CandidateProfile created for them.
  await redirectIfNotCandidate(user.id, user.email)

  let profile = await prisma.candidateProfile.findUnique({
    where: { userId: user.id },
    include: {
      references: true,
      workSamples: true,
      workHistory: true,
      employerInteractions: true,
      resumes: { orderBy: { uploadedAt: 'desc' } },
      jobPostings: { orderBy: { createdAt: 'desc' } },
      communityPosts: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
      surfacedJobs: { select: { reaction: true } },
      linkedInActivityLogs: true,
      marketRealityReports: { orderBy: { generatedAt: 'desc' }, take: 1 },
      assessmentResponses: { orderBy: { completedAt: 'desc' }, take: 1 },
      performanceAssessmentResponses: { orderBy: { completedAt: 'desc' }, take: 1 },
      _count: { select: { weeklySprints: true } },
      coach: { select: { focus: true } },
    },
  })

  if (!profile || !profile.assessmentComplete) {
    redirect('/onboarding')
  }

  const { profile: syncedBase, justRegistered } = await syncRegistrationCompletion(user, profile)
  profile = { ...profile, ...syncedBase }

  if (!profile.registrationCompletedAt) {
    redirect('/onboarding/create-account')
  }

  if (!profile.introCommittedAt) {
    redirect('/onboarding/welcome')
  }

  const [clientIp, requestHeaders] = await Promise.all([getClientIp(), headers()])
  const userAgent = requestHeaders.get('user-agent')
  after(() => recordCandidateLoginIfDue(profile.id, clientIp, userAgent))

  // First dashboard load after finishing registration — generate and email
  // the candidate's first Market Reality Report now that we have a real,
  // confirmed address to send it to (moved here from the score-reveal page,
  // which runs before an account exists).
  if (justRegistered) {
    const candidateId = profile.id
    after(async () => {
      // Two near-simultaneous loads (e.g. two tabs) can both see
      // justRegistered — only the one that wins the claim generates.
      if (await claimReportGeneration(candidateId)) {
        await generateMarketRealityReport(candidateId)
      }
      await sendMarketRealityReportEmail(candidateId)
    })
  }

  return profile
})
