import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { prisma } from '@/lib/prisma'
import { AssessmentForm } from '@/components/onboarding/AssessmentForm'
import { Greeting } from '@/components/onboarding/Greeting'
import { CURRENT_ASSESSMENT_ROTATION_GROUP } from '@/lib/constants/onboarding'

export default async function WorkingStylePage() {
  const profile = await getCandidateProfileForUser()

  const [blocks, likertItems] = await Promise.all([
    prisma.quadBlock.findMany({
      where: { rotationGroup: CURRENT_ASSESSMENT_ROTATION_GROUP, isActive: true },
      orderBy: { blockNumber: 'asc' },
      include: { statements: true },
    }),
    prisma.likertItem.findMany({
      where: { rotationGroup: CURRENT_ASSESSMENT_ROTATION_GROUP, isActive: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Greeting firstName={profile.firstName} />
        <h1 className="text-3xl font-bold tracking-tight text-navy">How do you prefer working</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          No wrong answers — this helps employers understand what makes you thrive, not just what
          you can do.
        </p>
      </div>
      <div className="rounded-lg border border-brand/30 bg-brand/5 p-4 text-base text-foreground">
        Your references will be asked these same questions about you. Answer as honestly as
        possible — how closely your self-view matches how others see you is itself part of your
        Hireability Score.
      </div>
      <AssessmentForm blocks={blocks} likertItems={likertItems} />
    </div>
  )
}
