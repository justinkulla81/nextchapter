import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { syncRegistrationCompletion } from '@/lib/onboarding/sync-registration'
import { generateHireabilityReport } from '@/lib/reports/hireability-report'
import { claimReportGeneration } from '@/lib/reports/report-generation-lock'
import { sendHireabilityReportEmail } from '@/lib/email/send-hireability-report'
import { redirectIfNotCandidate } from '@/lib/auth/redirect-non-candidate'
import { recordCandidateLoginIfDue } from '@/lib/auth/record-login'

export async function getDashboardData() {
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
      hireabilityReports: { orderBy: { generatedAt: 'desc' }, take: 1 },
      assessmentResponses: { orderBy: { completedAt: 'desc' }, take: 1 },
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

  after(() => recordCandidateLoginIfDue(profile.id))

  // First dashboard load after finishing registration — generate and email
  // the candidate's first Hireability Report now that we have a real,
  // confirmed address to send it to (moved here from the score-reveal page,
  // which runs before an account exists).
  if (justRegistered) {
    const candidateId = profile.id
    after(async () => {
      // Two near-simultaneous loads (e.g. two tabs) can both see
      // justRegistered — only the one that wins the claim generates.
      if (await claimReportGeneration(candidateId)) {
        await generateHireabilityReport(candidateId)
      }
      await sendHireabilityReportEmail(candidateId)
    })
  }

  return profile
}
