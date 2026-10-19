import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { computeMatchState } from '@/lib/personalization/match-compute'
import { signalInputsFor } from '@/lib/personalization/know-you'
import { buildSignals, type Signal } from '@/lib/personalization/signals'
import { effectiveJourney, getJourney } from '@/lib/journey/journey'
import { isPivotingProfile } from '@/lib/journey/pivot-target'
import { getCandidateWeekNumber, getMondayOfWeek } from '@/lib/weekly/sprint'
import { buildTailored } from '@/lib/redesign/tailored'
import { PageHeader } from '@/components/candidate/PageHeader'
import { TailoredRows } from '@/components/candidate/TailoredRows'
import { UnlocksSection } from '@/components/dashboard/home/UnlocksSection'
import { HomeModuleSkeleton } from '@/components/dashboard/home/HomeModuleSkeleton'
import { captureServerEvent } from '@/lib/posthog/server'
import { after } from 'next/server'

export const metadata: Metadata = { title: 'Improve your search' }

// Everything we use to tailor the site to this member, what each thing changes, and the one thing that
// would help most. The whole picture in one place: each fact is changed where it lives, never here.
export default async function ImprovePage() {
  const profile = await getDashboardData()
  const journey = effectiveJourney(profile)
  const searching = !journey || getJourney(journey).searching

  const [state, targetCompanies, weekNumber] = await Promise.all([
    computeMatchState(profile, { live: true }).catch((error) => {
      console.error('Improve your search: matching unavailable', error)
      return null
    }),
    prisma.companyWatchlistEntry.count({ where: { candidateId: profile.id } }).catch(() => 0),
    searching ? getCandidateWeekNumber(profile.id, getMondayOfWeek(new Date())).catch(() => null) : Promise.resolve(null),
  ])
  const signals: Signal[] = state ? buildSignals(signalInputsFor(profile, state)) : []
  const relocation = (profile.journeyDetails as { relocation?: unknown } | null)?.relocation

  const { groups, best } = buildTailored({
    journeyLabel: journey ? getJourney(journey).label : null,
    weekInSearch: searching ? weekNumber : null,
    coachingStyle: profile.coachingStylePreference,
    signals,
    relocationAnswered: !!relocation,
    moneyHelp: profile.moneyHelp,
    targetCompanies,
    recruitersCanSee: profile.recruiterDatabaseOptIn,
    confidential: profile.confidentialSearchMode,
    skillsConfirmed: profile.confirmedSkillsHave.length,
    skillsToBuild: profile.skillsToBuild.length,
    exploringOtherRoles: isPivotingProfile({ ...profile, journey: effectiveJourney(profile) }),
  })
  after(() => captureServerEvent(profile.id, 'improve_search_viewed', { open: groups.flatMap((g) => g.rows).filter((r) => !r.done).length, best: best?.key ?? null }))

  return (
    <div className="space-y-8">
      <PageHeader
        title="Improve your search"
        intro="Everything we use to tailor your suggestions, what each thing changes, and what would help most."
        action={
          best ? (
            <Link href={best.href} className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
              {best.cta}
            </Link>
          ) : undefined
        }
      />
      <TailoredRows groups={groups} />
      <Suspense fallback={<HomeModuleSkeleton title="Your proof" rows={2} />}>
        <UnlocksSection profile={profile} redesign />
      </Suspense>
      <p className="text-sm text-muted-foreground">
        Account and privacy settings are in{' '}
        <Link href="/dashboard/profile" className="font-medium text-brand underline underline-offset-4">
          Account and privacy
        </Link>
        .
      </p>
    </div>
  )
}
