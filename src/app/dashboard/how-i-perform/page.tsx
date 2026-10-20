import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { PerformanceAssessmentForm } from '@/components/dashboard/PerformanceAssessmentForm'
import { Button } from '@/components/ui/button'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { HOW_I_PERFORM_ITEMS } from '@/lib/constants/how-i-perform-items'
import { RoundsFlow } from '@/components/rounds/RoundsFlow'
import { effectiveJourney, getJourney } from '@/lib/journey/journey'
import { nextOptionalQuestion } from '@/lib/onboarding/finish'
import { answersFromScores } from '@/lib/redesign/performance-rounds'
import { saveHowIPerformRound } from './round-actions'

export const metadata: Metadata = { title: 'How I Perform' }

export default async function HowIPerformPage() {
  const profile = await getDashboardProfile()

  const latestResponse = await prisma.performanceAssessmentResponse.findFirst({
    where: { candidateId: profile.id },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true },
  })

  if (isRedesignOn(profile.email)) {
    // A round at a time is kept in a draft. If the draft table is not there yet, the flow still works and the browser keeps the answers.
    const draft = await prisma.performanceAssessmentDraft.findUnique({ where: { candidateId: profile.id } }).catch(() => null)
    const journey = effectiveJourney(profile)
    return (
      <div className="space-y-8">
        <PageHeader title="How I perform" intro="Forty statements about how you decide, execute and work through others, in short rounds of two or three. Each round is saved as you go." />
        <RoundsFlow
          flowId="how_i_perform"
          initialAnswers={answersFromScores((draft?.answers ?? null) as Record<string, number> | null)}
          completed={false}
          completedOn={latestResponse ? latestResponse.completedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null}
          save={saveHowIPerformRound}
          next={nextOptionalQuestion({ networkComfortLevel: profile.networkComfortLevel, searching: journey ? getJourney(journey).searching : true })}
          doneHref="/dashboard/skills-assessments"
          doneLabel="Back to how I work"
          otherHref="/dashboard/track-record"
          otherLabel="Track record: seven short rounds on the scope you have owned"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">How I Perform</h1>
        <p className="text-muted-foreground">
          40 quick statements about how you execute, decide, hold up under pressure, and get
          things done through other people. Your references answer these same questions about
          you — the comparison is what hiring managers actually want to see. There are no wrong
          answers here, but there is a right and wrong end to each one — answer honestly.
        </p>
        {latestResponse && (
          <p className="text-sm text-muted-foreground">
            Last completed {latestResponse.completedAt.toLocaleDateString()}.
          </p>
        )}
        <Button nativeButton={false} variant="outline" render={<Link href="/dashboard/skills-assessments" />} size="sm">
          Back to Assessments
        </Button>
      </div>

      <PerformanceAssessmentForm items={HOW_I_PERFORM_ITEMS} />
    </div>
  )
}
