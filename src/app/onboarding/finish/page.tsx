import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { Module } from '@/components/candidate/Module'
import { Chip } from '@/components/candidate/ui'
import { FinishActions } from '@/components/onboarding/bundles/FinishActions'
import { effectiveJourney, getJourney } from '@/lib/journey/journey'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { progressOf } from '@/lib/onboarding/progress'
import { prefilledAnswers } from '@/lib/onboarding/prefilled'
import { finishGains, nextOptionalQuestion } from '@/lib/onboarding/finish'
import { computeMatchState } from '@/lib/personalization/match-compute'
import { loadScanStatus } from '@/lib/onboarding/scan-counts'
import { prisma } from '@/lib/prisma'
import { ScanFound } from '@/components/onboarding/bundles/ScanFound'

// The finish screen of the short question bundles: what the member gained, and one optional next question.
// The one navy block on the page is the reveal; everything else is plain.
export default async function FinishPage({ searchParams }: { searchParams: Promise<{ tracking?: string }> }) {
  const profile = await getCandidateProfileForUser()
  if (flowOfProfile(profile) !== 'bundles') redirect('/onboarding')
  if (!progressOf(profile.journeyDetails).completed.includes('coach')) redirect('/onboarding')
  // The payoff comes after the Google step, which is what creates the account.
  if (!profile.registrationCompletedAt) redirect('/onboarding')

  const { tracking } = await searchParams
  const [scan, hasResume] = await Promise.all([
    loadScanStatus(profile.id),
    prisma.resume.count({ where: { candidateId: profile.id, looksLikeResume: { not: false } } }).then((n) => n > 0),
  ])

  const journey = effectiveJourney(profile)
  // Today's jobs against the saved answers. If counting fails the gain is simply left out, never faked.
  const matches = await computeMatchState(profile).then((s) => s?.counts.matches ?? null).catch(() => null)
  const gains = finishGains({
    journey,
    stage: profile.journeyStage,
    intensity: profile.searchIntensity,
    prefilled: prefilledAnswers(profile),
    jobs: matches === null ? null : { baseline: null, now: matches },
    hasCity: !!profile.currentCity,
    details: (profile.journeyDetails ?? {}) as Record<string, unknown>,
  })
  const searching = journey ? getJourney(journey).searching : true

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">All five steps done</p>
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance text-ink">
          {profile.firstName ? `${profile.firstName}, here is what you just gained.` : 'Here is what you just gained.'}
        </h1>
      </div>

      <ScanFound initial={scan} tracking={tracking === 'on' || tracking === 'pending' || tracking === 'off' ? tracking : null} />

      <Module title="What changed for you" tone="dark">
        <ul className="space-y-4">
          {gains.map((g) => (
            <li key={g.title} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Chip>{g.place}</Chip>
              <span className="min-w-0 flex-1 basis-64">
                <span className="block text-base font-semibold">{g.title}</span>
                <span className="block text-sm text-white/80">{g.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Module>

      <FinishActions question={nextOptionalQuestion({ networkComfortLevel: profile.networkComfortLevel, searching })} continueLabel={hasResume ? 'See my starting grade' : 'Continue'} />
    </div>
  )
}
