import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import {
  computeHireabilityGrade,
  GRADE_RELATIONS_INCLUDE,
  type CandidateWithGradeRelations,
} from '@/lib/scoring/hireability-grade'
import { GradeReveal } from '@/components/candidates/GradeReveal'
import { Button } from '@/components/ui/button'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'

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
    include: GRADE_RELATIONS_INCLUDE,
  })

  const grade = await computeHireabilityGrade(candidateWithRelations as unknown as CandidateWithGradeRelations)

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.firstName ? `Nice work, ${profile.firstName}!` : 'Your Current Market Reality'}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground italic">
          &ldquo;Your initial grade is based on what you&apos;ve told me. The confidence level on
          each Market Reality dimension will increase as I see which roles you&apos;re drawn to,
          which you reject, and what the market returns. The grade gets more accurate as we work
          together.&rdquo;
        </p>
        <div className="mt-1 flex items-center justify-center gap-2 not-italic">
          <VictoriaAvatar size={24} />
          <span className="text-xs text-muted-foreground/80">— Victoria</span>
        </div>
      </div>
      <GradeReveal grade={grade} />
      <Button nativeButton={false} render={<Link href="/onboarding/create-account" />}>
        Create your account to get your full report and action plan
      </Button>
    </div>
  )
}
