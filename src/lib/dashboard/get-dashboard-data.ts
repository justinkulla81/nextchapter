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

// The signed-in user, verified once per request and shared: getDashboardProfile
// below uses it, and pages that only need the user's email / confirmation state
// (the confirm-email banner, membership) read it from here instead of a second
// auth.getUser() network round trip.
export const getVerifiedSessionUser = cache(async () => {
  const supabase = await createClient()
  // proxy.ts already verified this session with Supabase Auth on this same request (and
  // refreshed its cookie), so a second getUser() here was a duplicate network round trip
  // on every dashboard page. getClaims() verifies the token's signature locally against
  // the project's signing keys instead; the user object then comes from the verified
  // session, and must belong to the same subject.
  const { data: claimsData } = await supabase.auth.getClaims()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return claimsData?.claims && session?.user.id === claimsData.claims.sub ? session.user : null
})

// Wrapped in React's cache() — this does a Supabase auth call plus a
// 13-relation Prisma query, and every dashboard page.tsx calls this AGAIN
// after dashboard/layout.tsx already called it once for the same request
// (nav badges, IdentifyUser). Without cache(), that's the same expensive
// fetch running twice on every single page load — cache() dedupes repeat
// calls within one request to a single execution, so the second call is
// free. Request-scoped only: a fresh navigation gets a fresh (uncached) run.
export const getDashboardProfile = cache(async () => {
  const user = await getVerifiedSessionUser()

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
      coach: { select: { focus: true } },
      linkedInConnection: { select: { disconnectedAt: true } },
      _count: { select: { weeklySprints: true } },
    },
  })

  if (!profile || !profile.assessmentComplete) {
    redirect('/onboarding')
  }

  // Deactivated (see deactivatedAt's own schema comment) — signs the
  // session out and sends them to a plain explanation page rather than
  // silently blocking every dashboard route one-by-one.
  if (profile.deactivatedAt) {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/account-deactivated')
  }

  const { profile: syncedBase, justRegistered } = await syncRegistrationCompletion(user, profile)
  profile = { ...profile, ...syncedBase }

  if (!profile.registrationCompletedAt) {
    redirect('/onboarding/create-account')
  }

  // A registered member with no name on file (an account made before the details step existed) is asked once.
  if (!profile.firstName?.trim() || !profile.lastName?.trim()) {
    redirect('/onboarding/details')
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
      await sendMarketRealityReportEmail(candidateId, { justEarnedBadge: true })
    })
  }

  return profile
})

// The wide version: the profile plus every relation the heavier pages read (all resumes, all
// job postings with their text, community posts, activity logs, ...). Loaded as ONE extra
// query keyed on the already-resolved profile id — no second auth call, redirect pass or
// registration sync — and only by pages that actually read those relations. Every other
// dashboard page, and the layout, use getDashboardProfile() above.
export const getDashboardData = cache(async () => {
  const profile = await getDashboardProfile()
  const relations = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: profile.id },
    select: {
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
    },
  })
  return { ...profile, ...relations }
})
