import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { TrackRecordForm } from '@/components/dashboard/TrackRecordForm'
import { RoundsFlow } from '@/components/rounds/RoundsFlow'
import { effectiveJourney, getJourney } from '@/lib/journey/journey'
import { nextOptionalQuestion } from '@/lib/onboarding/finish'
import { answersFromTrackRecord } from '@/lib/redesign/track-record-rounds'
import { saveTrackRecordRound } from './round-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Track Record' }

export default async function TrackRecordPage() {
  const profile = await getDashboardProfile()

  const response = await prisma.trackRecordResponse.findUnique({
    where: { candidateId: profile.id },
  })

  if (isRedesignOn(profile.email)) {
    const journey = effectiveJourney(profile)
    return (
      <div className="space-y-8">
        <PageHeader title="Track record" intro="Seven short rounds on the scope you have owned. Each one is saved as you go, so you can stop any time and pick up later." />
        <RoundsFlow
          flowId="track_record"
          initialAnswers={answersFromTrackRecord(response, profile.isPeopleManager)}
          completed={!!response?.completedAt}
          completedOn={response?.completedAt ? response.completedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null}
          save={saveTrackRecordRound}
          next={nextOptionalQuestion({ networkComfortLevel: profile.networkComfortLevel, searching: journey ? getJourney(journey).searching : true })}
          doneHref="/dashboard/skills-assessments"
          doneLabel="Back to how I work"
          otherHref="/dashboard/how-i-perform"
          otherLabel="How I perform: 40 statements in short rounds"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/skills-assessments"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Skills & Behavioral Assessments
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Track Record</h1>
        <p className="mt-1 text-muted-foreground">
          Scope, ownership, and the kind of situations you&apos;ve operated in. This feeds your
          Executive Dossier and Hiring Manager Notes — and one answer becomes a specific question
          we ask your references to confirm. Retake it any time your scope changes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Your track record</CardTitle>
        </CardHeader>
        <CardContent>
          <TrackRecordForm response={response} isPeopleManager={profile.isPeopleManager} />
        </CardContent>
      </Card>
    </div>
  )
}
