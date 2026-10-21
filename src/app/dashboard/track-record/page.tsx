import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/candidate/PageHeader'
import { RoundsFlow } from '@/components/rounds/RoundsFlow'
import { effectiveJourney, getJourney } from '@/lib/journey/journey'
import { nextOptionalQuestion } from '@/lib/onboarding/finish'
import { answersFromTrackRecord } from '@/lib/redesign/track-record-rounds'
import { saveTrackRecordRound } from './round-actions'

export const metadata: Metadata = { title: 'Track Record' }

export default async function TrackRecordPage() {
  const profile = await getDashboardProfile()

  const response = await prisma.trackRecordResponse.findUnique({
    where: { candidateId: profile.id },
  })

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
