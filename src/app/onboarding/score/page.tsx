import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { recalculateScore } from '@/lib/scoring/recalculate'
import { scoreToNextSteps } from '@/lib/scoring/employability-score'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
import { hasStartedSprint } from '@/lib/weekly/sprint'
import { DualGradeReveal } from '@/components/candidates/DualGradeReveal'
import { Button } from '@/components/ui/button'

export default async function ScorePage() {
  const profile = await getCandidateProfileForUser()

  if (!profile.assessmentComplete) {
    redirect('/onboarding')
  }

  if (profile.registrationCompletedAt) {
    redirect('/dashboard')
  }

  const { breakdown, visibilityTier } = await recalculateScore(profile.id, 'onboarding_complete')

  const candidateWithRelations = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: {
      references: true,
      workSamples: true,
      workHistory: true,
      interviewResponses: true,
      jobPostings: true,
      linkedInActivityLogs: true,
      communityPosts: { where: { isActive: true } },
      resumes: { orderBy: { uploadedAt: 'desc' } },
    },
  })

  const nextSteps = scoreToNextSteps(candidateWithRelations, breakdown)
  const grade = await computeHireabilityGrade(candidateWithRelations)
  const searchExecutionAvailable = await hasStartedSprint(profile.id)

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.firstName ? `Nice work, ${profile.firstName}!` : 'Your Hireability Grade'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          This is a living grade — it moves as you add signal.
        </p>
      </div>
      <DualGradeReveal
        grade={grade}
        tier={visibilityTier}
        nextSteps={nextSteps}
        searchExecutionAvailable={searchExecutionAvailable}
      />
      <Button render={<Link href="/onboarding/create-account" />}>
        Create your account to get your full report
      </Button>
    </div>
  )
}
