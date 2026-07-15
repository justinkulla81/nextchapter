import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { syncRegistrationCompletion } from '@/lib/onboarding/sync-registration'
import { generateHireabilityReport } from '@/lib/reports/hireability-report'
import { sendHireabilityReportEmail } from '@/lib/email/send-hireability-report'

export async function getDashboardData() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

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

  // First dashboard load after finishing registration — generate and email
  // the candidate's first Hireability Report now that we have a real,
  // confirmed address to send it to (moved here from the score-reveal page,
  // which runs before an account exists).
  if (justRegistered) {
    const candidateId = profile.id
    after(async () => {
      await generateHireabilityReport(candidateId)
      await sendHireabilityReportEmail(candidateId)
    })
  }

  return profile
}
