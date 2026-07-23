import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
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

  const candidateWithRelations = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: {
      references: true,
      workSamples: true,
      workHistory: true,
      jobPostings: true,
      linkedInActivityLogs: true,
      communityPosts: { where: { isActive: true } },
      resumes: { orderBy: { uploadedAt: 'desc' } },
      surfacedJobs: { select: { reaction: true } },
      _count: { select: { weeklySprints: true } },
      coach: { select: { focus: true } },
    },
  })

  const grade = await computeHireabilityGrade(candidateWithRelations)

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.firstName ? `Nice work, ${profile.firstName}!` : 'Your Market Reality Grade'}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground italic">
          &ldquo;Your initial grade is based on what you&apos;ve told me. The confidence level on
          each Market Reality dimension will increase as I see which roles you&apos;re drawn to,
          which you reject, and what the market returns. The grade gets more accurate as we work
          together.&rdquo;
          <span className="mt-1 block not-italic text-xs text-muted-foreground/80">— Victoria</span>
        </p>
      </div>
      <DualGradeReveal grade={grade} />
      <Button nativeButton={false} render={<Link href="/onboarding/create-account" />}>
        Create your account to get your full report and action plan
      </Button>
    </div>
  )
}
