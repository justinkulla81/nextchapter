import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { generateCoachShortlist } from '@/lib/coach/matching'
import { SubmitButton } from '@/components/ui/submit-button'
import { Spinner } from '@/components/ui/spinner'
import { submitCoachPreferences, selectCoach } from './actions'

export const metadata: Metadata = { title: 'Coach Matching' }

// generateCoachShortlist calls getCandidateLevelRank, which on a candidate's
// first-ever match request walks their work history through
// resolveCompanySizeBand per employer — isolated in its own Suspense
// boundary so the page header renders immediately either way.
async function CoachShortlist({ candidateId }: { candidateId: string }) {
  const shortlist = await generateCoachShortlist(candidateId)

  if (shortlist.length === 0) {
    return <p className="text-sm text-muted-foreground">No coaches are available to match right now — check back soon.</p>
  }
  return (
    <div className="space-y-3">
      {shortlist.map((coach) => (
        <div key={coach.id} className="rounded-lg border border-border p-4">
          <p className="font-medium text-foreground">{coach.fullName}</p>
          <p className="text-sm text-muted-foreground">
            {coach.firmName ?? 'Independent'} · {coach.focus}
          </p>
          {coach.industries.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">Industries: {coach.industries.join(', ')}</p>
          )}
          <form action={selectCoach.bind(null, coach.id)} className="mt-3">
            <SubmitButton size="sm" pendingLabel="Confirming…">
              Choose {coach.fullName.split(' ')[0]}
            </SubmitButton>
          </form>
        </div>
      ))}
    </div>
  )
}

function CoachShortlistSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
      <Spinner size={16} />
      Finding your best coach matches…
    </div>
  )
}


const selectClass =
  'mt-1 h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand'

export default async function CoachingMatchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const profile = await getDashboardData()

  if (profile.coachId) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const showShortlist = params.step === 'shortlist'

  if (!showShortlist) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Get matched with a coach</h1>
          <p className="text-muted-foreground">
            A few quick preferences — everything here is optional, skip anything you don&apos;t have a
            preference on.
          </p>
        </div>
        <form action={submitCoachPreferences} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="genderPreference">
              Coach gender
            </label>
            <select
              id="genderPreference"
              name="genderPreference"
              defaultValue={profile.coachGenderPreference ?? ''}
              className={selectClass}
            >
              <option value="">No preference</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="nonbinary">Non-binary</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="communicationStylePreference">
              Feedback style
            </label>
            <select
              id="communicationStylePreference"
              name="communicationStylePreference"
              defaultValue={profile.coachCommunicationStylePreference ?? ''}
              className={selectClass}
            >
              <option value="">No preference</option>
              <option value="direct">Direct — tell me straight, right away</option>
              <option value="context_first">Context first — walk me through the reasoning before critical feedback</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="languagePreference">
              Language
            </label>
            <input
              id="languagePreference"
              name="languagePreference"
              defaultValue={profile.coachLanguagePreference ?? ''}
              placeholder="e.g. English"
              className={selectClass}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="timezonePreference">
              Timezone
            </label>
            <input
              id="timezonePreference"
              name="timezonePreference"
              defaultValue={profile.coachTimezonePreference ?? ''}
              placeholder="e.g. ET"
              className={selectClass}
            />
          </div>
          <SubmitButton pendingLabel="Finding coaches…">See my matches</SubmitButton>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Your coach matches</h1>
        <p className="text-muted-foreground">Based on your target role, level, and preferences.</p>
      </div>
      <Suspense fallback={<CoachShortlistSkeleton />}>
        <CoachShortlist candidateId={profile.id} />
      </Suspense>
    </div>
  )
}
